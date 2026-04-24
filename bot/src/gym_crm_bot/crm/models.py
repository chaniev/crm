from __future__ import annotations

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

BotRole = Literal["HeadCoach", "Administrator", "Coach"]
MenuCode = Literal["attendance", "client_search", "expiring_memberships", "unpaid_memberships"]


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


class MenuResponse(ApiModel):
    user: BotUserContext | None = None
    items: list[MenuItem]


class AttendanceGroup(ApiModel):
    id: UUID
    name: str
    training_start_time: str | None = Field(default=None, alias="trainingStartTime")
    schedule_text: str | None = Field(default=None, alias="scheduleText")
    client_count: int | None = Field(default=None, alias="clientCount")


class AttendanceGroupsResponse(ApiModel):
    items: list[AttendanceGroup]


class AttendanceRosterClient(ApiModel):
    id: UUID
    full_name: str = Field(alias="fullName")
    is_present: bool = Field(alias="isPresent")
    membership_warning: str | None = Field(default=None, alias="membershipWarning")
    has_unpaid_current_membership: bool = Field(
        default=False,
        alias="hasUnpaidCurrentMembership",
    )

    @property
    def warning(self) -> str | None:
        return self.membership_warning

    @property
    def has_unpaid_membership(self) -> bool:
        return self.has_unpaid_current_membership


class AttendanceRosterResponse(ApiModel):
    group_id: UUID = Field(alias="groupId")
    group_name: str = Field(alias="groupName")
    training_date: date = Field(alias="trainingDate")
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
    has_unpaid_current_membership: bool = Field(
        default=False,
        alias="hasUnpaidCurrentMembership",
    )

    def __str__(self) -> str:
        details: list[str] = []
        if self.membership_warning:
            details.append(self.membership_warning)
        if self.has_unpaid_current_membership:
            details.append("не оплачен")
        suffix = f" ({', '.join(details)})" if details else ""
        return f"{self.full_name}{suffix}"


class AttendanceSaveResponse(ApiModel):
    group_name: str = Field(alias="groupName")
    training_date: date = Field(alias="trainingDate")
    marked_count: int = Field(alias="markedCount")
    present_count: int = Field(alias="presentCount")
    absent_count: int = Field(alias="absentCount")
    warnings: list[AttendanceSaveWarning] = Field(default_factory=list)


class ClientListItem(ApiModel):
    id: UUID = Field(validation_alias=AliasChoices("id", "clientId"))
    full_name: str = Field(alias="fullName")
    phone: str | None = None
    status: str | None = None
    membership_type: str | None = Field(default=None, alias="membershipType")
    membership_label: str | None = Field(default=None, alias="membershipLabel")
    membership_expires_at: date | None = Field(
        default=None,
        validation_alias=AliasChoices("membershipExpiresAt", "expirationDate"),
    )
    purchase_date: date | None = Field(default=None, alias="purchaseDate")
    days_until_expiration: int | None = Field(default=None, alias="daysUntilExpiration")
    is_paid: bool | None = Field(default=None, alias="isPaid")
    warning: str | None = Field(
        default=None,
        validation_alias=AliasChoices("warning", "membershipWarning"),
    )
    has_unpaid_current_membership: bool = Field(
        default=False,
        alias="hasUnpaidCurrentMembership",
    )
    has_active_paid_membership: bool = Field(default=False, alias="hasActivePaidMembership")

    @model_validator(mode="after")
    def fill_derived_fields(self) -> ClientListItem:
        if self.membership_label is None and self.membership_type:
            self.membership_label = self.membership_type
        if self.is_paid is None and self.has_unpaid_current_membership:
            self.is_paid = False
        return self


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
    membership_type: str = Field(alias="membershipType")
    purchase_date: date = Field(alias="purchaseDate")
    expiration_date: date | None = Field(default=None, alias="expirationDate")
    is_paid: bool = Field(alias="isPaid")

    @property
    def type_label(self) -> str:
        return self.membership_type


class ClientAttendanceHistoryEntry(ApiModel):
    training_date: date = Field(alias="trainingDate")
    is_present: bool = Field(alias="isPresent")
    group_name: str = Field(alias="groupName")


class ClientCardResponse(ApiModel):
    id: UUID
    full_name: str = Field(alias="fullName")
    phone: str | None = None
    groups: list[str] = Field(default_factory=list)
    status: str | None = None
    warning: str | None = Field(
        default=None,
        validation_alias=AliasChoices("warning", "membershipWarning"),
    )
    photo_url: str | None = Field(default=None, alias="photoUrl")
    current_membership: ClientCardMembership | None = Field(default=None, alias="currentMembership")
    attendance_history: list[ClientAttendanceHistoryEntry] = Field(
        default_factory=list,
        alias="attendanceHistory",
    )

    @field_validator("groups", mode="before")
    @classmethod
    def normalize_groups(cls, value: object) -> list[str]:
        if not isinstance(value, list):
            return []
        groups: list[str] = []
        for item in value:
            if isinstance(item, str):
                groups.append(item)
            elif isinstance(item, dict) and isinstance(item.get("name"), str):
                groups.append(item["name"])
        return groups


class MembershipListResponse(ApiModel):
    items: list[ClientListItem]
    page: int = 1
    page_size: int = Field(default=5, alias="pageSize")
    has_next_page: bool = Field(default=False, alias="hasNextPage")


class MembershipPaymentResult(ApiModel):
    client_id: UUID = Field(alias="clientId")
    full_name: str = Field(alias="fullName")
    membership_type: str = Field(
        validation_alias=AliasChoices("membershipType", "membershipLabel")
    )
    is_paid: bool | None = Field(default=None, alias="isPaid")
    raw_status: str | None = Field(default=None, alias="status")
    was_already_paid: bool = Field(default=False, alias="wasAlreadyPaid")

    @model_validator(mode="after")
    def normalize_status(self) -> MembershipPaymentResult:
        if self.is_paid is None:
            if self.raw_status is not None:
                self.is_paid = self.raw_status.lower() in {"paid", "оплачен", "already_paid"}
            else:
                self.is_paid = not self.was_already_paid
        return self

    @property
    def membership_label(self) -> str:
        return self.membership_type

    @property
    def status(self) -> str:
        if self.raw_status:
            return self.raw_status
        if self.was_already_paid:
            return "уже оплачен"
        return "оплачен" if self.is_paid else "не оплачен"
