using System;

namespace Xrm.Runner
{
    internal class Program
    {
        static void Main(string[] args)
        {
            try
            {
                CCP.Executor.ExecuteFromArgs(args, typeof(Program).Assembly);
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.Message + ":\r\n\r\n" + ex.StackTrace);
            }
        }
    }
}
