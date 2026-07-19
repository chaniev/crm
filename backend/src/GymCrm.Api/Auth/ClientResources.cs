using System.Globalization;
using System.Resources;

namespace GymCrm.Api.Auth;

internal static class ClientResources
{
    private static readonly ResourceManager ResourceManager = new(
        "GymCrm.Api.Auth.Resources.ClientResources",
        typeof(ClientResources).Assembly);

    public static string PageMustBeGreaterThanZero => GetString(nameof(PageMustBeGreaterThanZero));
    public static string SkipCannotBeNegative => GetString(nameof(SkipCannotBeNegative));
    public static string AttendanceSkipCannotBeNegative => GetString(nameof(AttendanceSkipCannotBeNegative));
    public static string InvalidStatus => GetString(nameof(InvalidStatus));
    public static string InvalidPaymentStatus => GetString(nameof(InvalidPaymentStatus));
    public static string MembershipExpirationRangeInvalid => GetString(nameof(MembershipExpirationRangeInvalid));
    public static string PhoneRequired => GetString(nameof(PhoneRequired));
    public static string PhoneTooLong => GetString(nameof(PhoneTooLong));
    public static string BranchRequired => GetString(nameof(BranchRequired));
    public static string InvalidBranchId => GetString(nameof(InvalidBranchId));
    public static string BranchMustExist => GetString(nameof(BranchMustExist));
    public static string BranchMustBeActive => GetString(nameof(BranchMustBeActive));
    public static string BranchTransferRequired => GetString(nameof(BranchTransferRequired));
    public static string NotesTooLong => GetString(nameof(NotesTooLong));
    public static string ProfessionalStatusRequired => GetString(nameof(ProfessionalStatusRequired));
    public static string ProfessionalCommentRequired => GetString(nameof(ProfessionalCommentRequired));
    public static string ProfessionalCommentTooLong => GetString(nameof(ProfessionalCommentTooLong));
    public static string LastNameTooLong => GetString(nameof(LastNameTooLong));
    public static string FirstNameTooLong => GetString(nameof(FirstNameTooLong));
    public static string MiddleNameTooLong => GetString(nameof(MiddleNameTooLong));
    public static string FullNameRequired => GetString(nameof(FullNameRequired));
    public static string ContactsLimitExceeded => GetString(nameof(ContactsLimitExceeded));
    public static string ContactTypeRequired => GetString(nameof(ContactTypeRequired));
    public static string ContactTypeTooLong => GetString(nameof(ContactTypeTooLong));
    public static string ContactFullNameRequired => GetString(nameof(ContactFullNameRequired));
    public static string ContactFullNameTooLong => GetString(nameof(ContactFullNameTooLong));
    public static string ContactPhoneRequired => GetString(nameof(ContactPhoneRequired));
    public static string ContactPhoneTooLong => GetString(nameof(ContactPhoneTooLong));
    public static string InvalidGroupId => GetString(nameof(InvalidGroupId));
    public static string ClientGroupsRequired => GetString(nameof(ClientGroupsRequired));
    public static string GroupsMustExist => GetString(nameof(GroupsMustExist));
    public static string GroupsMustBelongToClientBranch => GetString(nameof(GroupsMustBelongToClientBranch));
    public static string TransferGroupMustBelongToTargetBranch => GetString(nameof(TransferGroupMustBelongToTargetBranch));
    public static string PurchaseDateRequired => GetString(nameof(PurchaseDateRequired));
    public static string MembershipStartDateRequired => GetString(nameof(MembershipStartDateRequired));
    public static string RenewalDateRequired => GetString(nameof(RenewalDateRequired));
    public static string CurrentMembershipMissingForRenewal => GetString(nameof(CurrentMembershipMissingForRenewal));
    public static string CurrentMembershipWithoutExpirationDate => GetString(nameof(CurrentMembershipWithoutExpirationDate));
    public static string ExpirationBeforeRenewalDate => GetString(nameof(ExpirationBeforeRenewalDate));
    public static string CurrentMembershipMissingForCorrection => GetString(nameof(CurrentMembershipMissingForCorrection));
    public static string CurrentMembershipMissingForPaymentMark => GetString(nameof(CurrentMembershipMissingForPaymentMark));
    public static string PaymentAmountImmutableForPaymentMark => GetString(nameof(PaymentAmountImmutableForPaymentMark));
    public static string IsPaidRequired => GetString(nameof(IsPaidRequired));
    public static string PaymentMarkMustSetPaid => GetString(nameof(PaymentMarkMustSetPaid));
    public static string CurrentMembershipAlreadyPaid => GetString(nameof(CurrentMembershipAlreadyPaid));
    public static string ExpirationBeforePurchaseDate => GetString(nameof(ExpirationBeforePurchaseDate));
    public static string BehaviorKindRequired => GetString(nameof(BehaviorKindRequired));
    public static string InvalidBehaviorKind => GetString(nameof(InvalidBehaviorKind));
    public static string InvalidIsoDate => GetString(nameof(InvalidIsoDate));
    public static string PaymentAmountRequired => GetString(nameof(PaymentAmountRequired));
    public static string PaymentAmountMustBeNonNegative => GetString(nameof(PaymentAmountMustBeNonNegative));
    public static string RefundAmountRequired => GetString(nameof(RefundAmountRequired));
    public static string RefundAmountMustBePositive => GetString(nameof(RefundAmountMustBePositive));
    public static string RefundDateRequired => GetString(nameof(RefundDateRequired));
    public static string RefundDateInFuture => GetString(nameof(RefundDateInFuture));
    public static string RefundDateBeforePurchaseDate => GetString(nameof(RefundDateBeforePurchaseDate));
    public static string RefundDateBeforeSaleCreatedDate => GetString(nameof(RefundDateBeforeSaleCreatedDate));
    public static string RefundAmountExceedsGrossAmount => GetString(nameof(RefundAmountExceedsGrossAmount));
    public static string RefundAlreadyCanceled => GetString(nameof(RefundAlreadyCanceled));
    public static string RefundCommentTooLong => GetString(nameof(RefundCommentTooLong));
    public static string SaleMustExist => GetString(nameof(SaleMustExist));
    public static string RefundMustExist => GetString(nameof(RefundMustExist));
    public static string CorrectedGrossAmountBelowRefunds => GetString(nameof(CorrectedGrossAmountBelowRefunds));
    public static string CorrectedPurchaseDateAfterRefund => GetString(nameof(CorrectedPurchaseDateAfterRefund));
    public static string InvalidMembershipChangeRequest => GetString(nameof(InvalidMembershipChangeRequest));
    public static string CurrentMembershipMissingForAction => GetString(nameof(CurrentMembershipMissingForAction));
    public static string MembershipChangeFailed => GetString(nameof(MembershipChangeFailed));
    public static string ClientWithoutName => GetString(nameof(ClientWithoutName));
    public static string PhotoEmpty => GetString(nameof(PhotoEmpty));
    public static string PhotoInvalidRequest => GetString(nameof(PhotoInvalidRequest));
    public static string PhotoUnsupportedMediaType => GetString(nameof(PhotoUnsupportedMediaType));
    public static string PhotoInvalidImageContent => GetString(nameof(PhotoInvalidImageContent));
    public static string PhotoConversionUnavailableTitle => GetString(nameof(PhotoConversionUnavailableTitle));
    public static string PhotoConversionUnavailableDetail => GetString(nameof(PhotoConversionUnavailableDetail));
    public static string PhotoUploadForbiddenTitle => GetString(nameof(PhotoUploadForbiddenTitle));
    public static string PhotoUploadForbiddenDetail => GetString(nameof(PhotoUploadForbiddenDetail));
    public static string PhotoSaveUnsupportedResultTitle => GetString(nameof(PhotoSaveUnsupportedResultTitle));
    public static string PhotoSaveUnsupportedResultDetail => GetString(nameof(PhotoSaveUnsupportedResultDetail));
    public static string PhotoReadUnsupportedResultTitle => GetString(nameof(PhotoReadUnsupportedResultTitle));
    public static string PhotoReadUnsupportedResultDetail => GetString(nameof(PhotoReadUnsupportedResultDetail));
    public static string PhotoPayloadTooLargeTitle => GetString(nameof(PhotoPayloadTooLargeTitle));

    public static string PageSizeOutOfRange(int maxTake)
    {
        return Format(nameof(PageSizeOutOfRange), maxTake);
    }

    public static string TakeOutOfRange(int maxTake)
    {
        return Format(nameof(TakeOutOfRange), maxTake);
    }

    public static string AttendanceTakeOutOfRange(int maxTake)
    {
        return Format(nameof(AttendanceTakeOutOfRange), maxTake);
    }

    public static string CurrentBehaviorKindMismatch(string expectedBehaviorKind)
    {
        return Format(nameof(CurrentBehaviorKindMismatch), expectedBehaviorKind);
    }

    public static string PhotoFormContentTypeRequired(string formFieldName)
    {
        return Format(nameof(PhotoFormContentTypeRequired), formFieldName);
    }

    public static string PhotoSingleFileRequired(string formFieldName)
    {
        return Format(nameof(PhotoSingleFileRequired), formFieldName);
    }

    public static string PhotoPayloadTooLargeDetail(long maxUploadSizeBytes)
    {
        return Format(nameof(PhotoPayloadTooLargeDetail), maxUploadSizeBytes);
    }

    private static string Format(string name, params object[] args)
    {
        return string.Format(CultureInfo.CurrentCulture, GetString(name), args);
    }

    private static string GetString(string name)
    {
        return ResourceManager.GetString(name, CultureInfo.CurrentUICulture)
            ?? throw new InvalidOperationException($"Resource string '{name}' was not found.");
    }
}
