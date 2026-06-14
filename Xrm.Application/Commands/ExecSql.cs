using MarkMpn.Sql4Cds.Engine;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Globalization;
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
        public string Response { get; internal set; }

        // ── Request / response models ──────────────────────────────────
        public class RequestModel
        {
            [JsonProperty("sql")] public string Sql { get; set; }
            [JsonProperty("bypassCustomPlugins")] public bool BypassCustomPlugins { get; set; }
            [JsonProperty("useLocalTimeZone")] public bool UseLocalTimeZone { get; set; }
            [JsonProperty("blockDeleteWithoutWhere")] public bool BlockDeleteWithoutWhere { get; set; }
            [JsonProperty("blockUpdateWithoutWhere")] public bool BlockUpdateWithoutWhere { get; set; }
            [JsonProperty("useTDSEndpoint")] public bool UseTDSEndpoint { get; set; }
            [JsonProperty("formattingInfo")] public FormattingInfoModel FormattingInfo { get; set; }
        }

        public class FormattingInfoModel
        {
            [JsonProperty("languageId")] public int LanguageId { get; set; }
            [JsonProperty("shortDatePattern")] public string ShortDatePattern { get; set; }
            [JsonProperty("shortTimePattern")] public string ShortTimePattern { get; set; }
            [JsonProperty("longDatePattern")] public string LongDatePattern { get; set; }
            [JsonProperty("longTimePattern")] public string LongTimePattern { get; set; }
            [JsonProperty("dateSeparator")] public string DateSeparator { get; set; }
            [JsonProperty("timeSeparator")] public string TimeSeparator { get; set; }
            [JsonProperty("amDesignator")] public string AmDesignator { get; set; }
            [JsonProperty("pmDesignator")] public string PmDesignator { get; set; }
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

        // ── Handler ────────────────────────────────────────────────────
        public class Handler : CommandHandler<ExecSql>
        {
            public Handler(FlowArguments flowArgs) : base(flowArgs) { }

            public override VoidEvent Execute(ExecSql command)
            {
                var response = new ResponseModel();

                try
                {
                    var request = JsonConvert.DeserializeObject<RequestModel>(command.Request);

                    var (nfi, dtfi) = BuildFormatProviders(request.FormattingInfo);

                    using (var con = new Sql4CdsConnection(OrgServiceWrapper.OrgService))
                    using (var cmd = con.CreateCommand())
                    {
                        cmd.CommandText = request.Sql;

                        con.MaxDegreeOfParallelism = 1;
                        con.BypassCustomPlugins = request.BypassCustomPlugins;
                        con.UseLocalTimeZone = request.UseLocalTimeZone;
                        con.BlockDeleteWithoutWhere = request.BlockDeleteWithoutWhere;
                        con.BlockUpdateWithoutWhere = request.BlockUpdateWithoutWhere;
                        con.UseTDSEndpoint = request.UseTDSEndpoint;

                        cmd.StatementCompleted += (s, e) => response.RecordsAffected += e.RecordsAffected;

                        using (var reader = cmd.ExecuteReader())
                        {
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
                                        row[i] = reader.IsDBNull(i)
                                            ? null
                                            : FormatValue(reader.GetValue(i), nfi, dtfi);
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

            // ── Format providers ───────────────────────────────────────
            private static (NumberFormatInfo nfi, DateTimeFormatInfo dtfi) BuildFormatProviders(FormattingInfoModel fmt)
            {
                NumberFormatInfo nfi;
                DateTimeFormatInfo dtfi;

                if (fmt != null && fmt.LanguageId > 0)
                {
                    try
                    {
                        var culture = new CultureInfo(fmt.LanguageId);
                        nfi = (NumberFormatInfo)culture.NumberFormat.Clone();
                        dtfi = (DateTimeFormatInfo)culture.DateTimeFormat.Clone();
                    }
                    catch
                    {
                        nfi = (NumberFormatInfo)CultureInfo.InvariantCulture.NumberFormat.Clone();
                        dtfi = (DateTimeFormatInfo)CultureInfo.InvariantCulture.DateTimeFormat.Clone();
                    }
                }
                else
                {
                    nfi = (NumberFormatInfo)CultureInfo.InvariantCulture.NumberFormat.Clone();
                    dtfi = (DateTimeFormatInfo)CultureInfo.InvariantCulture.DateTimeFormat.Clone();
                }

                // Apply explicit client-side overrides so Dataverse-configured date patterns
                // take precedence over the CultureInfo defaults for the same LCID.
                if (fmt != null)
                {
                    if (!string.IsNullOrEmpty(fmt.ShortDatePattern)) dtfi.ShortDatePattern = fmt.ShortDatePattern;
                    if (!string.IsNullOrEmpty(fmt.ShortTimePattern)) dtfi.ShortTimePattern = fmt.ShortTimePattern;
                    if (!string.IsNullOrEmpty(fmt.LongDatePattern)) dtfi.LongDatePattern = fmt.LongDatePattern;
                    if (!string.IsNullOrEmpty(fmt.LongTimePattern)) dtfi.LongTimePattern = fmt.LongTimePattern;
                    if (!string.IsNullOrEmpty(fmt.DateSeparator)) dtfi.DateSeparator = fmt.DateSeparator;
                    if (!string.IsNullOrEmpty(fmt.TimeSeparator)) dtfi.TimeSeparator = fmt.TimeSeparator;
                    if (!string.IsNullOrEmpty(fmt.AmDesignator)) dtfi.AMDesignator = fmt.AmDesignator;
                    if (!string.IsNullOrEmpty(fmt.PmDesignator)) dtfi.PMDesignator = fmt.PmDesignator;
                }

                return (nfi, dtfi);
            }

            // ── Value formatter ────────────────────────────────────────
            private static string FormatValue(object value, NumberFormatInfo nfi, DateTimeFormatInfo dtfi)
            {
                if (value == null) return null;

                switch (Type.GetTypeCode(value.GetType()))
                {
                    case TypeCode.DateTime:
                        return ((DateTime)value).ToString("g", dtfi);

                    case TypeCode.Decimal:
                        return ((decimal)value).ToString("G", nfi);

                    case TypeCode.Double:
                        var d = (double)value;
                        return double.IsNaN(d) || double.IsInfinity(d)
                            ? d.ToString()
                            : d.ToString("G", nfi);

                    case TypeCode.Single:
                        var f = (float)value;
                        return float.IsNaN(f) || float.IsInfinity(f)
                            ? f.ToString()
                            : f.ToString("G", nfi);

                    case TypeCode.Int16:
                    case TypeCode.Int32:
                    case TypeCode.Int64:
                    case TypeCode.UInt16:
                    case TypeCode.UInt32:
                    case TypeCode.UInt64:
                        return ((IFormattable)value).ToString("G", nfi);

                    default:
                        return value.ToString();
                }
            }
        }
    }
}
