using GymCrm.Domain.Clients;

namespace GymCrm.Tests;

public sealed class ClientMembershipCommentPolicyTests
{
    [Fact]
    public void Apply_normalizes_and_classifies_transitions_without_touching_metadata_on_noop()
    {
        var sale = new ClientMembershipSale();
        var firstActor = Guid.NewGuid();
        var secondActor = Guid.NewGuid();
        var now = DateTimeOffset.Parse("2026-07-21T12:34:56.987Z");

        Assert.Equal("set", ClientMembershipCommentPolicy.Apply(sale, "  note  ", firstActor, now));
        Assert.Equal("note", sale.Comment);
        Assert.Equal(firstActor, sale.CommentChangedByUserId);
        Assert.Equal(DateTimeOffset.Parse("2026-07-21T12:34:56Z"), sale.CommentChangedAt);

        Assert.Null(ClientMembershipCommentPolicy.Apply(sale, " note ", secondActor, now.AddMinutes(1)));
        Assert.Equal(firstActor, sale.CommentChangedByUserId);
        Assert.Equal(DateTimeOffset.Parse("2026-07-21T12:34:56Z"), sale.CommentChangedAt);

        Assert.Equal("changed", ClientMembershipCommentPolicy.Apply(sale, "changed", secondActor, now.AddMinutes(1)));
        Assert.Equal("cleared", ClientMembershipCommentPolicy.Apply(sale, "  ", firstActor, now.AddMinutes(2)));
        Assert.Null(sale.Comment);
        Assert.Equal(firstActor, sale.CommentChangedByUserId);
    }

    [Fact]
    public void Normalize_accepts_boundary_and_rejects_too_long_comment()
    {
        Assert.Equal(new string('x', 2000), ClientMembershipCommentPolicy.Normalize(new string('x', 2000)));
        Assert.Throws<ArgumentException>(() => ClientMembershipCommentPolicy.Normalize(new string('x', 2001)));
        Assert.Null(ClientMembershipCommentPolicy.Normalize(null));
        Assert.Null(ClientMembershipCommentPolicy.Normalize(" \t "));
    }
}
