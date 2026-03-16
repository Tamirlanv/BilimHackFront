from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.deps import DBSession, get_current_user
from app.models import (
    Group,
    GroupInvitation,
    GroupInviteLink,
    GroupMembership,
    InvitationStatus,
    PreferredLanguage,
    StudentProfile,
    User,
    UserRole,
)
from app.schemas.profile import (
    GroupInviteAcceptResponse,
    GroupInvitePreviewResponse,
    ProfileInvitationResponse,
    ProfileResponse,
)

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/me", response_model=ProfileResponse)
def my_profile(
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> ProfileResponse:
    group_id = current_user.student_profile.group_id if current_user.student_profile else None
    group_name = None
    if group_id is not None:
        group = db.get(Group, group_id)
        group_name = group.name if group else None

    invitations = (
        _load_teacher_invitations(db=db, teacher_id=current_user.id)
        if current_user.role == UserRole.teacher
        else _load_user_invitations(db=db, user_id=current_user.id)
    )
    return ProfileResponse(
        id=current_user.id,
        role=current_user.role,
        email=current_user.email,
        full_name=current_user.full_name,
        username=current_user.username,
        preferred_language=(current_user.student_profile.preferred_language if current_user.student_profile else None),
        education_level=(current_user.student_profile.education_level if current_user.student_profile else None),
        direction=(current_user.student_profile.direction if current_user.student_profile else None),
        group_id=group_id,
        group_name=group_name,
        invitations=invitations,
    )


@router.post("/invitations/{invitation_id}/accept", response_model=ProfileInvitationResponse)
def accept_invitation(
    invitation_id: int,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> ProfileInvitationResponse:
    invitation = _get_user_invitation(db=db, invitation_id=invitation_id, user_id=current_user.id)
    if invitation.status != InvitationStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Приглашение уже обработано")

    if invitation.group_id is not None:
        target_group = db.get(Group, invitation.group_id)
        if not target_group:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Группа приглашения больше не существует")

        current_membership = db.scalar(select(GroupMembership).where(GroupMembership.student_id == current_user.id))
        is_same_group = bool(current_membership and current_membership.group_id == target_group.id)
        if not is_same_group:
            members_count = db.scalar(select(func.count(GroupMembership.id)).where(GroupMembership.group_id == target_group.id)) or 0
            max_members_limit = _effective_group_members_limit()
            if int(members_count) >= max_members_limit:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"В группе уже максимум {max_members_limit} участников.",
                )

        db.execute(delete(GroupMembership).where(GroupMembership.student_id == current_user.id))
        db.add(GroupMembership(student_id=current_user.id, group_id=target_group.id))

        profile = db.get(StudentProfile, current_user.id)
        if not profile:
            profile = StudentProfile(
                user_id=current_user.id,
                preferred_language=PreferredLanguage.ru,
            )
            db.add(profile)
        profile.group_id = target_group.id

    invitation.status = InvitationStatus.accepted
    invitation.responded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(invitation)
    return _serialize_profile_invitation(invitation)


@router.get("/group-invites/{token}", response_model=GroupInvitePreviewResponse)
def preview_group_invite(
    token: str,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> GroupInvitePreviewResponse:
    if current_user.role != UserRole.student:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Приглашения доступны только ученикам.")

    invite_link = _get_active_group_invite_link(db=db, token=token)
    if invite_link.group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Группа приглашения не найдена.")
    if invite_link.teacher is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Преподаватель приглашения не найден.")

    max_members_limit = _effective_group_members_limit()
    members_count = _count_group_members(db=db, group_id=invite_link.group_id)
    already_member = _is_student_in_group(db=db, student_id=current_user.id, group_id=invite_link.group_id)

    return GroupInvitePreviewResponse(
        token=invite_link.token,
        teacher_id=int(invite_link.teacher_id),
        teacher_name=(invite_link.teacher.full_name or invite_link.teacher.username),
        group_id=int(invite_link.group_id),
        group_name=invite_link.group.name,
        already_member=already_member,
        members_count=members_count,
        members_limit=max_members_limit,
    )


@router.post("/group-invites/{token}/accept", response_model=GroupInviteAcceptResponse)
def accept_group_invite_by_token(
    token: str,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> GroupInviteAcceptResponse:
    if current_user.role != UserRole.student:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Приглашения доступны только ученикам.")

    invite_link = _get_active_group_invite_link(db=db, token=token)
    if invite_link.group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Группа приглашения не найдена.")
    if invite_link.teacher is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Преподаватель приглашения не найден.")

    target_group = invite_link.group
    already_member = _is_student_in_group(db=db, student_id=current_user.id, group_id=target_group.id)

    joined = False
    if not already_member:
        max_members_limit = _effective_group_members_limit()
        members_count = _count_group_members(db=db, group_id=target_group.id)
        if members_count >= max_members_limit:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"В группе уже максимум {max_members_limit} участников.",
            )

        db.execute(delete(GroupMembership).where(GroupMembership.student_id == current_user.id))
        db.add(GroupMembership(student_id=current_user.id, group_id=target_group.id))

        profile = db.get(StudentProfile, current_user.id)
        if not profile:
            profile = StudentProfile(
                user_id=current_user.id,
                preferred_language=PreferredLanguage.ru,
            )
            db.add(profile)
        profile.group_id = target_group.id
        joined = True

    invite_link.uses_count = int(invite_link.uses_count or 0) + 1
    invite_link.last_used_at = datetime.now(timezone.utc)

    db.commit()

    return GroupInviteAcceptResponse(
        token=invite_link.token,
        teacher_id=int(invite_link.teacher_id),
        teacher_name=(invite_link.teacher.full_name or invite_link.teacher.username),
        group_id=int(invite_link.group_id),
        group_name=target_group.name,
        already_member=already_member,
        joined=joined,
    )


@router.post("/invitations/{invitation_id}/decline", response_model=ProfileInvitationResponse)
def decline_invitation(
    invitation_id: int,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> ProfileInvitationResponse:
    invitation = _get_user_invitation(db=db, invitation_id=invitation_id, user_id=current_user.id)
    if invitation.status != InvitationStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Приглашение уже обработано")

    invitation.status = InvitationStatus.declined
    invitation.responded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(invitation)
    return _serialize_profile_invitation(invitation)


def _load_user_invitations(*, db: DBSession, user_id: int) -> list[ProfileInvitationResponse]:
    invitations = db.scalars(
        select(GroupInvitation)
        .options(joinedload(GroupInvitation.teacher), joinedload(GroupInvitation.group))
        .where(GroupInvitation.student_id == user_id)
        .order_by(GroupInvitation.created_at.desc())
    ).all()
    return [_serialize_profile_invitation(item) for item in invitations]


def _load_teacher_invitations(*, db: DBSession, teacher_id: int) -> list[ProfileInvitationResponse]:
    invitations = db.scalars(
        select(GroupInvitation)
        .options(joinedload(GroupInvitation.student), joinedload(GroupInvitation.group))
        .where(GroupInvitation.teacher_id == teacher_id)
        .order_by(GroupInvitation.created_at.desc())
    ).all()
    return [_serialize_profile_invitation_for_teacher(item) for item in invitations]


def _get_user_invitation(*, db: DBSession, invitation_id: int, user_id: int) -> GroupInvitation:
    invitation = db.scalar(
        select(GroupInvitation)
        .options(joinedload(GroupInvitation.teacher), joinedload(GroupInvitation.group))
        .where(
            GroupInvitation.id == invitation_id,
            GroupInvitation.student_id == user_id,
        )
    )
    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Приглашение не найдено")
    return invitation


def _serialize_profile_invitation(invitation: GroupInvitation) -> ProfileInvitationResponse:
    teacher_name = invitation.teacher.full_name or invitation.teacher.username
    return ProfileInvitationResponse(
        id=invitation.id,
        teacher_id=invitation.teacher_id,
        teacher_name=teacher_name,
        group_id=invitation.group_id,
        group_name=(invitation.group.name if invitation.group else None),
        status=invitation.status,
        created_at=invitation.created_at,
        responded_at=invitation.responded_at,
    )


def _serialize_profile_invitation_for_teacher(invitation: GroupInvitation) -> ProfileInvitationResponse:
    student_name = invitation.student.full_name or invitation.student.username
    return ProfileInvitationResponse(
        id=invitation.id,
        teacher_id=invitation.student_id,
        teacher_name=student_name,
        group_id=invitation.group_id,
        group_name=(invitation.group.name if invitation.group else None),
        status=invitation.status,
        created_at=invitation.created_at,
        responded_at=invitation.responded_at,
    )


def _effective_group_members_limit() -> int:
    return max(30, int(settings.group_max_members or 0))


def _count_group_members(*, db: DBSession, group_id: int) -> int:
    value = db.scalar(select(func.count(GroupMembership.id)).where(GroupMembership.group_id == group_id))
    return int(value or 0)


def _is_student_in_group(*, db: DBSession, student_id: int, group_id: int) -> bool:
    membership = db.scalar(
        select(GroupMembership.id).where(
            GroupMembership.student_id == student_id,
            GroupMembership.group_id == group_id,
        )
    )
    return membership is not None


def _get_active_group_invite_link(*, db: DBSession, token: str) -> GroupInviteLink:
    normalized_token = token.strip()
    if not normalized_token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ссылка приглашения недействительна.")

    invite_link = db.scalar(
        select(GroupInviteLink)
        .options(
            joinedload(GroupInviteLink.teacher),
            joinedload(GroupInviteLink.group),
        )
        .where(
            GroupInviteLink.token == normalized_token,
            GroupInviteLink.is_active.is_(True),
        )
    )
    if not invite_link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ссылка приглашения недействительна.")

    now = datetime.now(timezone.utc)
    if invite_link.expires_at and invite_link.expires_at <= now:
        invite_link.is_active = False
        db.commit()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Срок действия ссылки истёк.")

    return invite_link
