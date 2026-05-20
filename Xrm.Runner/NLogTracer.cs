using Microsoft.Xrm.Sdk;
using NLog;

namespace Xrm.Runner
{
    public class NLogTracer : ITracingService
    {
        readonly ILogger logger = LogManager.GetCurrentClassLogger();

        public void Trace(string format, params object[] args)
        {
            logger.Trace(string.Format(format, args));
        }
    }
}
