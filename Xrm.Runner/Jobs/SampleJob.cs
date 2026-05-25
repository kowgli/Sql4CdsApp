using CCP;
using CCP.Attributes;

namespace Xrm.Runner.Jobs
{
    public class SampleJob : BaseCrmJob, IOperation
    {
        [Required]
        public int TestParameter { get; set; }

        public void Run()
        {
            TracingService.Trace($"Running {nameof(SampleJob)} with TestParameter={TestParameter}");

            //Handle(new SampleCommand());
        }
    }
}
