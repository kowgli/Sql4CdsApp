using MarkMpn.Sql4Cds.Engine;
using System;
using Xrm.Application.Events;
using Xrm.Domain.Attributes;
using Xrm.Domain.Flow;
using Xrm.Domain.Interfaces;

namespace Xrm.Application.Commands
{
    public class ExecSql : ICommand
    {
        public string Request { get; set; }

        [Output]
        public string Response { get; set; }

        public class Handler : CommandHandler<ExecSql>
        {
            public Handler(FlowArguments flowArgs) : base(flowArgs)
            {
            }

            public override VoidEvent Execute(ExecSql command)
            {
                string log = "";
                int count = 0;

                try
                {
                    using (var con = new Sql4CdsConnection(OrgServiceWrapper.OrgService))
                    using (var cmd = con.CreateCommand())
                    {
                        cmd.CommandText = "INSERT INTO ACCOUNT(name) VALUES('test')";

                        cmd.ExecuteNonQuery();

                        cmd.CommandText = "SELECT COUNT(*) AS Cnt FROM ACCOUNT";


                        con.MaxDegreeOfParallelism = 1;
                        con.UseTDSEndpoint = false;

                        log += "Beofre exec reader...\r\n";

                        using (var reader = cmd.ExecuteReader())
                        {
                            log += "IN while...\r\n";

                            while (reader.Read())
                            {
                                log += "Rdr read...\r\n";

                                count = reader.GetInt32(0);
                                log += "Rdr read OK OK...\r\n";
                            }
                        }

                        command.Response = log;
                    }
                }
                catch (Exception ex)
                {
                    command.Response = "ERROR: " + ex.Message + "\r\n" + log;
                }

                return VoidEvent;
            }
        }
    }
}
