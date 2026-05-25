using Xrm.Application.Commands;
using Xrm.Plugin.Base;

namespace Xrm.Plugin.Sql4CdsApp
{
    public class ExecSqlPostExecute : Base.Plugin
    {
        public ExecSqlPostExecute() : this("", "") { }

        public ExecSqlPostExecute(string unsecureConfig, string secureConfig) : base(typeof(ExecSqlPostExecute), unsecureConfig, secureConfig)
        {
            RegisterPluginStep<AnyEntity>(EventOperation.cd365_ExecSql, ExecutionStage.PostOperation, Execute);
        }

        private void Execute(LocalPluginContext localContext)
        {
            string request = GetInput<string>(localContext, "Request");

            var cmd = new ExecSql { Request = request };

            localContext.Handle(cmd);

            SetOutput(localContext, "Response", cmd.Response);
        }
    }
}
