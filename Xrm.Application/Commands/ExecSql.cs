using MarkMpn.Sql4Cds.Engine;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
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

        public class RequestModel
        {
            [JsonProperty("sql")] public string Sql { get; set; }
            [JsonProperty("bypassCustomPlugins")] public bool BypassCustomPlugins { get; set; }
            [JsonProperty("useLocalTimeZone")] public bool UseLocalTimeZone { get; set; }
            [JsonProperty("blockDeleteWithoutWhere")] public bool BlockDeleteWithoutWhere { get; set; }
            [JsonProperty("blockUpdateWithoutWhere")] public bool BlockUpdateWithoutWhere { get; set; }
        }

        public class ResponseModel
        {
            [JsonProperty("columns")] public string[] Columns { get; set; }
            [JsonProperty("rows")] public List<string[]> Rows { get; set; }
            [JsonProperty("recordsAffected")] public int RecordsAffected { get; set; }
            [JsonProperty("emptyResult")] public bool EmptyResult { get; set; }
            [JsonProperty("isSuccess")] public bool IsSuccess { get; set; }
            [JsonProperty("errorText")] public string ErrorText { get; set; }
        }


        public class Handler : CommandHandler<ExecSql>
        {
            public Handler(FlowArguments flowArgs) : base(flowArgs)
            {
            }

            public override VoidEvent Execute(ExecSql command)
            {
                ResponseModel response = new ResponseModel();

                try
                {
                    RequestModel request = JsonConvert.DeserializeObject<RequestModel>(command.Request);
                
                    using (var con = new Sql4CdsConnection(OrgServiceWrapper.OrgService))
                    using (var cmd = con.CreateCommand())
                    {
                        cmd.CommandText = request.Sql;

                        con.MaxDegreeOfParallelism = 1;
                        con.UseTDSEndpoint = false;

                        con.BypassCustomPlugins = request.BypassCustomPlugins;
                        con.UseLocalTimeZone = request.UseLocalTimeZone;
                        con.BlockDeleteWithoutWhere = request.BlockDeleteWithoutWhere;
                        con.BlockUpdateWithoutWhere = request.BlockUpdateWithoutWhere;

                        cmd.StatementCompleted += (s, e) => response.RecordsAffected += e.RecordsAffected;

                        using (var reader = cmd.ExecuteReader())
                        {
                            // FieldCount > 0 means a SELECT result set; for DML the reader has no schema
                            if (!reader.IsClosed && reader.FieldCount > 0)
                            {
                                var columns = new string[reader.FieldCount];
                                for (int i = 0; i < reader.FieldCount; i++)
                                    columns[i] = reader.GetName(i);

                                response.Columns = columns;
                                response.Rows = new List<string[]>();

                                while (reader.Read())
                                {
                                    var row = new string[reader.FieldCount];
                                    for (int i = 0; i < reader.FieldCount; i++)
                                        row[i] = reader.IsDBNull(i) ? null : reader.GetValue(i)?.ToString();
                                    response.Rows.Add(row);
                                }

                                response.EmptyResult = false;
                            }
                            else
                            {
                                response.EmptyResult = true;
                            }
                        }
                    }

                    response.IsSuccess = true;
                }
                catch (Exception ex)
                {
                    response.IsSuccess = false;
                    response.ErrorText = ex.Message;                    
                }

                command.Response = JsonConvert.SerializeObject(response);

                return VoidEvent;
            }
        }
    }
}
