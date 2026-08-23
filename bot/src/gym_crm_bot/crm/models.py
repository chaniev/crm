from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

BotRole = Literal["HeadCoach", "SuperAdministrator", "Administrator", "Coach"]
MembershipBehaviorKind = Literal["SingleVisit", "Term", "Professional"]
MembershipSalePricingMode = Literal["Catalog", "CatalogOverride", "AmountOnly"]
MembershipCoverageKind = Literal["TargetGroups", "AllGroups"]
MembershipEntitlementState = Literal[
    "Active",
    "Future",
    "Expired",
    "UsedSingleVisit",
    "LegacyTargetMissing",
]
MenuCode = Literal["attendance", "client_search", "expiring_memberships"]


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class TelegramIdentity(ApiModel):
    platform: Literal["Telegram"] = "Telegram"
    platform_user_id: str = Field(alias="platformUserId")

    def as_query_params(self) -> dict[str, str]:
        return {"platform": self.platform, "platformUserId": self.platform_user_id}

    def as_payload(self) -> dict[str, str]:
        return self.as_query_params()


class BotUserContext(ApiModel):
    user_id: UUID = Field(
        validation_alias=AliasChoices("userId", "crmUserId", "user_id", "crm_user_id")
    )
    full_name: str = Field(
        validation_alias=AliasChoices("fullName", "displayName", "full_name", "display_name")
    )
    login: str | None = None
    role: BotRole
    platform: str = "Telegram"
    platform_user_id: str | None = Field(default=None, alias="platformUserId")

    @property
    def crm_user_id(self) -> UUID:
        return self.user_id

    @property
    def display_name(self) -> str:
        return self.full_name


class MenuItem(ApiModel):
    code: MenuCode
    label: str = Field(validation_alias=AliasChoices("label", "title"))

    @property
    def title(self) -> str:
        return self.label


class AttendanceDateWindow(ApiModel):
    today: date
    min_training_date: date | None = Field(alias="minTrainingDate")
    max_training_date: date = Field(alias="maxTrainingDate")


class MenuResponse(ApiModel):
    user: BotUserContext
    attendance_date_window: AttendanceDateWindow = Field(alias="attendanceDateWindow")
    items: list[MenuItem]


class AttendanceGroup(ApiModel):
    id: UUID
    name: str
    training_start_time: str | None = Field(default=None, alias="trainingStartTime")
    duration_minutes: int | None = Field(default=None, alias="durationMinutes")
    weekdays: list[int] = Field(default_factory=list)
    client_count: int | None = Field(default=None, alias="clientCount")


class AttendanceLessonTrainer(ApiModel):
    trainer_id: UUID | None = Field(default=None, alias="trainerId")
    full_name: str = Field(validation_alias=AliasChoices("fullName", "name", "full_name"))
    kind: str | None = None
    replaced_trainer_id: UUID | None = Field(default=None, alias="replacedTrainerId")
    substitution_id: UUID | None = Field(default=None, alias="substitutionId")

    @property
    def is_replacement(self) -> bool:
        return bool(self.substitution_id or self.replaced_trainer_id or self.kind == "Substitute")

    @property
    def display_name(self) -> str:
        return f"{self.full_name} (замена)" if self.is_replacement else self.full_name


class AttendanceLesson(ApiModel):
    lesson_occurrence_id: UUID = Field(alias="lessonOccurrenceId")
    lesson_date: date = Field(alias="lessonDate")
    group_id: UUID = Field(alias="groupId")
    group_name: str = Field(alias="groupName")
    start_time: str = Field(alias="startTime")
    duration_minutes: int = Field(alias="durationMinutes")
    hall_name: str = Field(alias="hallName")
    branch_name: str = Field(alias="branchName")
    effective_trainers: list[AttendanceLessonTrainer] = Field(
        default_factory=list,
        alias="effectiveTrainers",
    )
    status: Literal["Scheduled", "Cancelled"] = "Scheduled"
    can_view_attendance: bool = Field(default=True, alias="canViewAttendance")
    can_edit_attendance: bool = Field(default=False, alias="canEditAttendance")

    @field_validator("effective_trainers", mode="before")
    @classmethod
    def _coerce_effective_trainers(cls, value: Any) -> Any:
        if value is None:
            return []
        if isinstance(value, list):
            return [{"fullName": item} if isinstance(item, str) else item for item in value]
        return value

    @property
    def id(self) -> UUID:
        return self.lesson_occurrence_id

    @property
    def name(self) -> str:
        return self.group_name

    @property
    def training_start_time(self) -> str:
        return self.start_time

    @property
    def weekdays(self) -> list[int]:
        return [self.lesson_date.isoweekday()]


class AttendanceGroupsResponse(ApiModel):
    items: list[AttendanceGroup]


class AttendanceLessonsResponse(ApiModel):
    items: list[AttendanceLesson]


class AttendanceRosterClient(ApiModel):
    id: UUID
    full_name: str = Field(alias="fullName")
    is_present: bool = Field(alias="isPresent")
    is_professional: bool = Field(default=False, alias="isProfessional")
    professional_comment: str | None = Field(default=None, alias="professionalComment")
    membership_warning: str | None = Field(default=None, alias="membershipWarning")
    has_active_membership: bool = Field(default=False, alias="hasActiveMembership")

    @property
    def warning(self) -> str | None:
        return self.membership_warning


class AttendanceRosterResponse(ApiModel):
    group_id: UUID = Field(alias="groupId")
    group_name: str = Field(alias="groupName")
    training_date: date = Field(alias="trainingDate")
    attendance_date_window: AttendanceDateWindow = Field(alias="attendanceDateWindow")
    clients: list[AttendanceRosterClient]

    @property
    def group(self) -> AttendanceGroup:
        return AttendanceGroup(id=self.group_id, name=self.group_name)


class AttendanceMarkRequest(ApiModel):
    client_id: UUID = Field(alias="clientId")
    is_present: bool = Field(alias="isPresent")


class AttendanceSaveWarning(ApiModel):
    client_id: UUID = Field(alias="clientId")
    full_name: str = Field(alias="fullName")
    membership_warning: str | None = Field(default=None, alias="membershipWarning")

    def __str__(self) -> str:
        details: list[str] = []
        if self.membership_warning:
            details.append(self.membership_warning)
        suffix = f" ({', '.join(details)})" if details else ""
        return f"{self.full_name}{suffix}"


class AttendanceSaveResponse(ApiModel):
    group_name: str = Field(alias="groupName")
    training_date: date = Field(alias="trainingDate")
    attendance_date_window: AttendanceDateWindow = Field(alias="attendanceDateWindow")
    marked_count: int = Field(alias="markedCount")
    present_count: int = Field(alias="presentCount")
    absent_count: int = Field(alias="absentCount")
    warnings: list[AttendanceSaveWarning] = Field(default_factory=list)


class ClientMembershipTargetGroup(ApiModel):
    group_id: UUID = Field(alias="groupId")
    group_name: str = Field(alias="groupName")
    branch_id: UUID = Field(alias="branchId")
    branch_name: str = Field(alias="branchName")
    position: int
    is_active: bool = Field(alias="isActive")


class ClientListItem(ApiModel):
    id: UUID = Field(validation_alias=AliasChoices("id", "clientId"))
    membership_id: UUID | None = Field(default=None, alias="membershipId")
    sale_id: UUID | None = Field(default=None, alias="saleId")
    full_name: str = Field(alias="fullName")
    phone: str | None = None
    status: str | None = None
    behavior_kind: MembershipBehaviorKind | None = Field(default=None, alias="behaviorKind")
    membership_label: str | None = Field(default=None, alias="membershipLabel")
    membership_expires_at: date | None = Field(
        default=None,
        validation_alias=AliasChoices("membershipExpiresAt", "expirationDate"),
    )
    purchase_date: date | None = Field(default=None, alias="purchaseDate")
    days_until_expiration: int | None = Field(default=None, alias="daysUntilExpiration")
    is_professional: bool = Field(default=False, alias="isProfessional")
    professional_comment: str | None = Field(default=None, alias="professionalComment")
    warning: str | None = Field(
        default=None,
        validation_alias=AliasChoices("warning", "membershipWarning"),
    )
    has_active_membership: bool = Field(default=False, alias="hasActiveMembership")
    target_groups: list[ClientMembershipTargetGroup] = Field(
        default_factory=list,
        alias="targetGroups",
    )


class ClientSearchResponse(ApiModel):
    items: list[ClientListItem]
    skip: int = 0
    take: int = 5
    has_more: bool = Field(default=False, alias="hasMore")

    @property
    def page(self) -> int:
        return max(1, (self.skip // max(self.take, 1)) + 1)

    @property
    def page_size(self) -> int:
        return self.take

    @property
    def has_next_page(self) -> bool:
        return self.has_more


class ClientCardMembership(ApiModel):
    id: UUID
    sale_id: UUID = Field(alias="saleId")
    behavior_kind: MembershipBehaviorKind = Field(alias="behaviorKind")
    membership_catalog_item_id: UUID | None = Field(alias="membershipCatalogItemId")
    membership_label: str = Field(alias="membershipLabel")
    purchase_date: date = Field(alias="purchaseDate")
    payment_date: date = Field(alias="paymentDate")
    expiration_date: date | None = Field(default=None, alias="expirationDate")
    pricing_mode: MembershipSalePricingMode = Field(alias="pricingMode")
    gross_amount: Decimal = Field(alias="grossAmount")
    catalog_price: Decimal | None = Field(alias="catalogPrice")
    coverage_kind: MembershipCoverageKind = Field(alias="coverageKind")
    entitlement_state: MembershipEntitlementState = Field(alias="entitlementState")
    target_groups: list[ClientMembershipTargetGroup] = Field(alias="targetGroups")

    @property
    def type_label(self) -> str:
        return self.membership_label


class ClientAttendanceHistoryEntry(ApiModel):
    training_date: date = Field(alias="trainingDate")
    is_present: bool = Field(alias="isPresent")
    group_name: str = Field(alias="groupName")


class ClientGroupSummary(ApiModel):
    id: UUID | None = None
    name: str
    training_start_time: str | None = Field(default=None, alias="trainingStartTime")
    duration_minutes: int | None = Field(default=None, alias="durationMinutes")
    weekdays: list[int] = Field(default_factory=list)


class ClientCardResponse(ApiModel):
    id: UUID
    full_name: str = Field(alias="fullName")
    phone: str | None = None
    groups: list[ClientGroupSummary] = Field(default_factory=list)
    status: str | None = None
    is_professional: bool = Field(default=False, alias="isProfessional")
    professional_comment: str | None = Field(default=None, alias="professionalComment")
    has_active_membership: bool = Field(default=False, alias="hasActiveMembership")
    warning: str | None = Field(
        default=None,
        validation_alias=AliasChoices("warning", "membershipWarning"),
    )
    photo_url: str | None = Field(default=None, alias="photoUrl")
    current_memberships: list[ClientCardMembership] = Field(
        default_factory=list,
        alias="currentMemberships",
    )
    attendance_history: list[ClientAttendanceHistoryEntry] = Field(
        default_factory=list,
        alias="attendanceHistory",
    )

    @field_validator("groups", mode="before")
    @classmethod
    def normalize_groups(cls, value: object) -> list[dict[str, object]]:
        if not isinstance(value, list):
            return []

        groups: list[dict[str, object]] = []
        for item in value:
            if isinstance(item, str):
                groups.append({"name": item})
            elif isinstance(item, dict):
                groups.append(item)
        return groups


class MembershipListResponse(ApiModel):
    items: list[ClientListItem]
    page: int = 1
    page_size: int = Field(default=5, alias="pageSize")
    has_next_page: bool = Field(default=False, alias="hasNextPage")
