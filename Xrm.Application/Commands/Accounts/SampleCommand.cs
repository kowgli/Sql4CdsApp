using Microsoft.Xrm.Sdk;
using Xrm.Application.Events;
using Xrm.Application.Queries;
using Xrm.Domain.Crm;
using Xrm.Domain.Flow;
using Xrm.Domain.Interfaces;

namespace Xrm.Application.Commands.Accounts
{
    public class SampleCommand : ICommand
    {
        public Account Target { get; set; }

        public IPluginExecutionContext ExecutionContext { get; set; }

        public class Handler : CommandHandler<SampleCommand>
        {
            private readonly AccountQueries accountQueries;

            public Handler(FlowArguments flowArgs, AccountQueries accountQueries) : base(flowArgs)
            {
                this.accountQueries = accountQueries ?? throw new System.ArgumentNullException(nameof(accountQueries));
            }

            public override VoidEvent Execute(SampleCommand command)
            {
                _ = accountQueries.GetName(command.Target.Id);

                return VoidEvent;
            }
        }
    }
}