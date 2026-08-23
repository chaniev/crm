using System.Globalization;
using GymCrm.Application.Clients;
using GymCrm.Domain.Clients;
using GymCrm.Domain.Memberships;
using Microsoft.AspNetCore.Http.HttpResults;
using static GymCrm.Api.Auth.ClientEndpointSharedHelpers;

namespace GymCrm.Api.Auth;

internal static class ClientMembershipRequestValidation
{
    internal static Dictionary<string, string[]> ValidatePurchaseMembershipRequest(PurchaseClientMembershipRequest request, DateOnly businessDate)
    {
        var errors = new Dictionary<string, string[]>();
        ValidateAdditionalFields(request.AdditionalFields, errors);
        ValidatePricingSelection(request.MembershipCatalogItemId, request.ManualSaleAmount, errors);
        _ = ValidateOptionalDate(request.ValidFrom, "validFrom", errors);
        _ = ValidateOptionalDate(request.ValidTo, "validTo", errors);
        ValidateCatalogPayment(request.PaymentStatus, request.IsPaid, request.PaymentDate, businessDate, errors);
        ValidateTargetGroupIds(request.TargetGroupIds, errors);

        return errors;
    }

    internal static Dictionary<string, string[]> ValidateRenewMembershipRequest(
        RenewClientMembershipRequest request,
        Client client,
        DateOnly businessDate)
    {
        var errors = new Dictionary<string, string[]>();
        ValidateAdditionalFields(request.AdditionalFields, errors);
        ValidatePricingSelection(request.MembershipCatalogItemId, request.ManualSaleAmount, errors);
        ValidateRequiredGuid(request.SaleId, "saleId", errors);
        ValidateRequiredGuid(request.ExpectedMembershipId, "expectedMembershipId", errors);
        ValidateTargetGroupIds(request.TargetGroupIds, errors);
        ValidateCatalogPayment(request.PaymentStatus, request.IsPaid, request.PaymentDate, businessDate, errors);

        return errors;
    }

    internal static void ValidateCatalogPayment(
        string? status,
        bool? isPaid,
        string? paymentDate,
        DateOnly businessDate,
        Dictionary<string, string[]> errors)
    {
        if (!string.IsNullOrWhiteSpace(status) &&
            !string.Equals(status.Trim(), "Paid", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(status.Trim(), "Unpaid", StringComparison.OrdinalIgnoreCase))
        {
            errors["paymentStatus"] = ["Payment status is no longer accepted. Remove paymentStatus and send paymentDate."];
        }

        if (string.Equals(status?.Trim(), "Unpaid", StringComparison.OrdinalIgnoreCase) || isPaid == false)
        {
            errors["paymentStatus"] = ["Unpaid membership status was removed."];
        }

        ValidateRequiredPaymentDate(paymentDate, businessDate, errors);
    }

    internal static ProblemHttpResult? CreateRemovedPaymentMarkerProblem(string? paymentStatus, bool? isPaid)
    {
        if (string.Equals(paymentStatus?.Trim(), "Unpaid", StringComparison.OrdinalIgnoreCase) || isPaid == false)
        {
            return CreateProblem(
                StatusCodes.Status400BadRequest,
                "membership-payment-status-removed",
                "Unpaid membership status was removed.",
                new Dictionary<string, string[]> { ["paymentStatus"] = ["Unpaid membership status was removed."] });
        }

        return null;
    }

    internal static ProblemHttpResult CreateProblem(
        int statusCode,
        string type,
        string title,
        Dictionary<string, string[]> errors)
    {
        return TypedResults.Problem(new HttpValidationProblemDetails(errors)
        {
            Status = statusCode,
            Type = type,
            Title = title,
            Detail = title
        });
    }

    internal static void ValidatePricingSelection(
        Guid? membershipCatalogItemId,
        decimal? manualSaleAmount,
        Dictionary<string, string[]> errors)
    {
        if (membershipCatalogItemId == Guid.Empty)
        {
            errors["membershipCatalogItemId"] = ["Membership catalog item id is invalid."];
        }

        if (!membershipCatalogItemId.HasValue && !manualSaleAmount.HasValue)
        {
            const string message = "Choose a catalog item or provide a manual sale amount.";
            errors["membershipCatalogItemId"] = [message];
            errors["manualSaleAmount"] = [message];
            return;
        }

        if (manualSaleAmount.HasValue &&
            !RubMoneyPolicy.IsWholeAmount(manualSaleAmount.Value, allowZero: false))
        {
            errors["manualSaleAmount"] =
                ["Manual sale amount must be a positive whole number of RUB within the supported range."];
        }
    }

    internal static Dictionary<string, string[]> ValidateCorrectMembershipRequest(
        CorrectClientMembershipRequest request,
        Client client,
        DateOnly businessDate)
    {
        var errors = new Dictionary<string, string[]>();
        ValidateAdditionalFields(request.AdditionalFields, errors);
        ValidateRequiredGuid(request.SaleId, "saleId", errors);
        ValidateRequiredGuid(request.ExpectedMembershipId, "expectedMembershipId", errors);
        ValidateTargetGroupIds(request.TargetGroupIds, errors);
        var validFrom = ValidateRequiredDate(request.ValidFrom, "validFrom", ClientResources.PurchaseDateRequired, errors);
        var validTo = ValidateOptionalDate(request.ValidTo, "validTo", errors);
        ValidateRequiredPaymentDate(request.PaymentDate, businessDate, errors);
        if (validFrom.HasValue && validTo.HasValue && validTo < validFrom)
            errors["validTo"] = [ClientResources.ExpirationBeforePurchaseDate];

        return errors;
    }

    private static void ValidateRequiredPaymentDate(
        string? paymentDate,
        DateOnly businessDate,
        Dictionary<string, string[]> errors)
    {
        var parsedPaymentDate = ValidateOptionalDate(paymentDate, "paymentDate", errors);
        if (errors.ContainsKey("paymentDate"))
        {
            return;
        }

        switch (ClientMembershipPaymentDatePolicy.Validate(parsedPaymentDate, businessDate))
        {
            case ClientMembershipPaymentDateValidationResult.Missing:
                errors["paymentDate"] = ["Payment date is required."];
                break;
            case ClientMembershipPaymentDateValidationResult.Future:
                errors["paymentDate"] = ["Payment date cannot be in the future."];
                break;
        }
    }

    private static void ValidateTargetGroupIds(
        IReadOnlyList<Guid>? targetGroupIds,
        Dictionary<string, string[]> errors)
    {
        if (targetGroupIds is null || targetGroupIds.Count == 0)
        {
            errors["targetGroupIds"] = ["Выберите хотя бы одну группу."];
            return;
        }

        if (targetGroupIds.Count > ClientMembershipTargetPolicy.MaxTargetCount)
        {
            errors["targetGroupIds"] = ["Можно выбрать не больше 5 групп."];
        }

        for (var index = 0; index < targetGroupIds.Count; index++)
        {
            if (targetGroupIds[index] == Guid.Empty)
            {
                errors[$"targetGroupIds[{index}]"] = ["Identifier is required for this membership operation."];
            }
        }

        if (targetGroupIds.GroupBy(groupId => groupId).Any(group => group.Count() > 1))
        {
            errors["targetGroupIds"] = ["Группа уже выбрана."];
        }
    }

    internal static Dictionary<string, string[]> ValidateRefundRequest(CreateClientMembershipRefundRequest request)
    {
        var errors = new Dictionary<string, string[]>();

        if (!request.Amount.HasValue)
        {
            errors["amount"] = [ClientResources.RefundAmountRequired];
        }
        else if (!RubMoneyPolicy.IsWholeAmount(request.Amount.Value, allowZero: false))
        {
            errors["amount"] = ["Refund amount must be a positive whole number of RUB within the supported range."];
        }

        ValidateRequiredDate(request.RefundDate, "refundDate", ClientResources.RefundDateRequired, errors);

        var comment = NormalizeOptionalText(request.Comment);
        if (comment is not null && comment.Length > ClientMembershipRefund.CommentMaxLength)
        {
            errors["comment"] = [ClientResources.RefundCommentTooLong];
        }

        return errors;
    }

    private static void ValidateMembershipDateRange(
        MembershipBehaviorKind? behaviorKind,
        DateOnly? purchaseDate,
        DateOnly? expirationDate,
        Dictionary<string, string[]> errors,
        string expirationDateKey)
    {
        if (behaviorKind is MembershipBehaviorKind.SingleVisit || !purchaseDate.HasValue || !expirationDate.HasValue)
        {
            return;
        }

        if (expirationDate.Value < purchaseDate.Value)
        {
            errors[expirationDateKey] = [ClientResources.ExpirationBeforePurchaseDate];
        }
    }

    private static MembershipBehaviorKind? ValidateRequiredBehaviorKind(
        string? behaviorKind,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(behaviorKind))
        {
            errors["behaviorKind"] = [ClientResources.BehaviorKindRequired];
            return null;
        }

        var parsedBehaviorKind = ParseBehaviorKind(behaviorKind);
        if (parsedBehaviorKind is null)
        {
            errors["behaviorKind"] = [ClientResources.InvalidBehaviorKind];
        }

        return parsedBehaviorKind;
    }

    private static void ValidateOptionalMatchingBehaviorKind(
        string? behaviorKind,
        MembershipBehaviorKind expectedBehaviorKind,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(behaviorKind))
        {
            return;
        }

        var parsedBehaviorKind = ParseBehaviorKind(behaviorKind);
        if (parsedBehaviorKind is null)
        {
            errors["behaviorKind"] = [ClientResources.InvalidBehaviorKind];
            return;
        }

        if (parsedBehaviorKind.Value != expectedBehaviorKind)
        {
            errors["behaviorKind"] = [ClientResources.CurrentBehaviorKindMismatch(expectedBehaviorKind.ToString())];
        }
    }

    private static DateOnly? ValidateRequiredDate(
        string? value,
        string key,
        string requiredMessage,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors[key] = [requiredMessage];
            return null;
        }

        var parsedDate = ParseIsoDate(value);
        if (parsedDate is null)
        {
            errors[key] = [ClientResources.InvalidIsoDate];
        }

        return parsedDate;
    }

    private static DateOnly? ValidateOptionalDate(
        string? value,
        string key,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var parsedDate = ParseIsoDate(value);
        if (parsedDate is null)
        {
            errors[key] = [ClientResources.InvalidIsoDate];
        }

        return parsedDate;
    }

    private static void ValidateRequiredGuid(
        Guid? value,
        string key,
        Dictionary<string, string[]> errors)
    {
        if (!value.HasValue || value.Value == Guid.Empty)
        {
            errors[key] = ["Identifier is required for this membership operation."];
        }
    }

    private static MembershipBehaviorKind? ParseBehaviorKind(string? behaviorKind)
    {
        return Enum.TryParse<MembershipBehaviorKind>(behaviorKind?.Trim(), ignoreCase: true, out var parsedBehaviorKind)
            ? parsedBehaviorKind
            : null;
    }

    internal static DateOnly? ParseIsoDate(string? value)
    {
        return DateOnly.TryParseExact(
            value?.Trim(),
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var parsedDate)
            ? parsedDate
            : null;
    }

    internal static Dictionary<string, string[]> CreateMembershipOperationError(ClientMembershipMutationError error)
    {
        return error switch
        {
            ClientMembershipMutationError.InvalidRequest => new Dictionary<string, string[]>
            {
                ["membership"] = [ClientResources.InvalidMembershipChangeRequest]
            },
            ClientMembershipMutationError.CurrentMembershipMissing => new Dictionary<string, string[]>
            {
                ["currentMembership"] = [ClientResources.CurrentMembershipMissingForAction]
            },
            ClientMembershipMutationError.CurrentMembershipAlreadyPaid => new Dictionary<string, string[]>
            {
                ["currentMembership"] = [ClientResources.CurrentMembershipAlreadyPaid]
            },
            ClientMembershipMutationError.CorrectedPurchaseDateAfterRefund => new Dictionary<string, string[]>
            {
                ["purchaseDate"] = [ClientResources.CorrectedPurchaseDateAfterRefund]
            },
            ClientMembershipMutationError.PricingSelectionMissing => new Dictionary<string, string[]>
            {
                ["membershipCatalogItemId"] = ["Choose a catalog item or provide a manual sale amount."],
                ["manualSaleAmount"] = ["Choose a catalog item or provide a manual sale amount."]
            },
            ClientMembershipMutationError.ManualSaleAmountInvalid => new Dictionary<string, string[]>
            {
                ["manualSaleAmount"] = ["Manual sale amount must be a positive whole number of RUB within the supported range."]
            },
            ClientMembershipMutationError.ProfessionalOverrideNotAllowed => new Dictionary<string, string[]>
            {
                ["manualSaleAmount"] = ["Professional membership can only use its zero catalog price."]
            },
            ClientMembershipMutationError.ProfessionalPermissionDenied => new Dictionary<string, string[]>
            {
                ["membershipCatalogItemId"] = ["Only HeadCoach can assign Professional membership."]
            },
            ClientMembershipMutationError.CatalogItemMissing or
            ClientMembershipMutationError.CatalogItemBranchMismatch or
            ClientMembershipMutationError.CatalogItemUnavailable => new Dictionary<string, string[]>
            {
                ["membershipCatalogItemId"] = ["Selected membership catalog item is not available for this client."]
            },
            _ => new Dictionary<string, string[]>
            {
                ["membership"] = [ClientResources.MembershipChangeFailed]
            }
        };
    }

    internal static Results<Ok<ClientDetailsResponse>, NotFound, ValidationProblem, ProblemHttpResult, UnauthorizedHttpResult> MapRefundMutationError(
        ClientMembershipRefundMutationError error)
    {
        if (error == ClientMembershipRefundMutationError.ClientMissing)
        {
            return TypedResults.NotFound();
        }

        return TypedResults.ValidationProblem(error switch
        {
            ClientMembershipRefundMutationError.SaleMissing => new Dictionary<string, string[]>
            {
                ["saleId"] = [ClientResources.SaleMustExist]
            },
            ClientMembershipRefundMutationError.RefundMissing => new Dictionary<string, string[]>
            {
                ["refundId"] = [ClientResources.RefundMustExist]
            },
            ClientMembershipRefundMutationError.RefundAmountExceedsGrossAmount => new Dictionary<string, string[]>
            {
                ["amount"] = [ClientResources.RefundAmountExceedsGrossAmount]
            },
            ClientMembershipRefundMutationError.RefundDateInFuture => new Dictionary<string, string[]>
            {
                ["refundDate"] = [ClientResources.RefundDateInFuture]
            },
            ClientMembershipRefundMutationError.RefundDateBeforePurchaseDate => new Dictionary<string, string[]>
            {
                ["refundDate"] = [ClientResources.RefundDateBeforePurchaseDate]
            },
            ClientMembershipRefundMutationError.RefundDateBeforeSaleCreatedDate => new Dictionary<string, string[]>
            {
                ["refundDate"] = [ClientResources.RefundDateBeforeSaleCreatedDate]
            },
            ClientMembershipRefundMutationError.RefundAlreadyCanceled => new Dictionary<string, string[]>
            {
                ["refund"] = [ClientResources.RefundAlreadyCanceled]
            },
            _ => new Dictionary<string, string[]>
            {
                ["refund"] = [ClientResources.InvalidMembershipChangeRequest]
            }
        });
    }
}
