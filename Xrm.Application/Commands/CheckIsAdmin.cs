using System;
using Xrm.Application.Events;
using Xrm.Application.Queries;
using Xrm.Domain.Attributes;
using Xrm.Domain.Flow;
using Xrm.Domain.Interfaces;

namespace Xrm.Application.Commands
{
    public class CheckIsAdmin : ICommand
    {
        public Guid UserId { get; set; }

        [Output]
        public bool IsAdministrator { get; internal set; }

        public class Handler : CommandHandler<CheckIsAdmin>
        {
            private readonly SystemUserQueries systemUserQueries;

            public Handler(FlowArguments flowArgs, SystemUserQueries systemUserQueries) : base(flowArgs)
            {
                this.systemUserQueries = systemUserQueries ?? throw new ArgumentNullException(nameof(systemUserQueries));
            }

            public override VoidEvent Execute(CheckIsAdmin command)
            {
                command.IsAdministrator = systemUserQueries.IsSystemAdministrator(command.UserId);
                return VoidEvent;
            }
        }
    }
}
