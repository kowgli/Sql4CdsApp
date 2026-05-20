using Xrm.Application.Commands.Accounts;
using Xrm.Domain.Crm;
using Xrm.Plugin.Base;

namespace Xrm.Plugin.Template
{
    public class AccountPostUpdate : Base.Plugin
    {
        public AccountPostUpdate() : this("", "") { }

        public AccountPostUpdate(string unsecureConfig, string secureConfig) : base(typeof(AccountPostUpdate), unsecureConfig, secureConfig)
        {
            RegisterPluginStep<Account>(EventOperation.Update, ExecutionStage.PostOperation, Execute)
                                       .AddFilteredAttributes(x => x.Name, x => x.EMailAddress1)
                                       .AddImage(ImageType.PreImage);
        }

        private void Execute(LocalPluginContext localContext)
        {
            Account target = localContext.GetTarget().ToEntity<Account>();

            localContext.Handle(new SampleCommand { Target = target, ExecutionContext = localContext.PluginExecutionContext });
        }
    }
}
