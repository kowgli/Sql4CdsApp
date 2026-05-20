using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;

namespace Xrm.Application.Helpers
{
    public static class CrmHelper
    {
        /// <summary>
        /// Get's the current value of the attribute combining data from the PreImage and Target.
        /// </summary>
        /// <returns></returns>
        public static T TrueValue<T>(Entity target, Entity preImage, string attributeName)
        {
            if(target == null || preImage == null || attributeName == null)
            {
                return default;
            }
            
            attributeName = attributeName.ToLower();

            T targetValue = target.GetAttributeValue<T>(attributeName);
            T preValue = preImage.GetAttributeValue<T>(attributeName);

            if (preValue == null || targetValue != null)
            {
                return targetValue;
            }
            else
            {
                if (target.HasAttribute(attributeName))
                {
                    return default;
                }
                else
                {
                    return preValue;
                }
            }
        }

        /// <summary>
        /// Checks if the attribute value did change (from preImage to Target)
        /// </summary>
        public static bool AttributeValueChanged(Entity target, Entity preImage, string attributeName)
        {
            attributeName = (attributeName ?? "").ToLowerInvariant();

            if (!target.Contains(attributeName))
            {
                return false;
            }
            
            if(target.Contains(attributeName) && target[attributeName] != null && !preImage.Contains(attributeName))
            {
                return true;
            }

            if (target[attributeName] == null && (!preImage.Contains(attributeName) || preImage[attributeName] == null)) { return false; }

            return !Equals(target[attributeName],preImage[attributeName]);
        }

        /// <summary>
        /// Does the entity have the attribute filled (equal to [entity].Attributes.ContainKey)
        /// </summary>
        public static bool HasAttribute(this Entity entity, string attributeName)
        {
            if(entity == null || attributeName == null)
            {
                return false;
            }

            return entity.Attributes.ContainsKey(attributeName.ToLowerInvariant());
        }

        /// <summary>
        /// Does the entity have any of attributes filled (equal to [entity].Attributes.ContainKey)
        /// </summary>
        public static bool HasAnyAttribute(this Entity entity, params string[] attributeNames)
        {
            if (attributeNames == null || attributeNames.Length == 0) { return false; }

            return attributeNames.Any(a => HasAttribute(entity, a));
        }

        public static T LatestValue<T>(Entity target, Entity preImage, string attributeName)
        {
            if (target == null || preImage == null || attributeName == null)
            {
                return default;
            }

            attributeName = attributeName.ToLower();

            if (AttributeValueChanged(target, preImage, attributeName))
                return target.GetAttributeValue<T>(attributeName);
            else
                return preImage.GetAttributeValue<T>(attributeName);
        }

        public static void CreateWithBypassPlugins(IOrganizationService orgService, Entity entity)
        {
            ExecWithBypassPlugins(orgService, new CreateRequest
            {
                Target = entity
            });
        }

        public static void UpdateWithBypassPlugins(IOrganizationService orgService, Entity entity)
        {
            ExecWithBypassPlugins(orgService, new UpdateRequest
            {
                Target = entity
            });
        }

        public static void DeleteWithBypassPlugins(IOrganizationService orgService, string logicalName, Guid id)
        {
            ExecWithBypassPlugins(orgService, new DeleteRequest
            {
                Target = new EntityReference(logicalName, id)
            });
        }

        public static void ExecWithBypassPlugins(IOrganizationService orgService, OrganizationRequest req)
        {
            AddPluginBypass(req);

            orgService.Execute(req);
        }

        public static void AddPluginBypass(OrganizationRequest req)
        {
            req.Parameters.Add("BypassCustomPluginExecution", true);
        }

        public static List<ExecuteMultipleResponseItem> PerformAsBulkMultiThread<T>(IOrganizationService service, IEnumerable<T> requests, bool continueOnError = true, int chunkSize = 1000, bool skipPlugins = false, bool writeStatusToConsole = false, int threads = 1) where T : OrganizationRequest
        {
            var arr = requests.ToArray();
            var splitReqs = from i in Enumerable.Range(0, arr.Length)
                            group arr[i] by i / chunkSize;

            var resps = new List<ExecuteMultipleResponseItem>();

            int execNo = 0;
            int count = splitReqs.Count();

            Parallel.ForEach(splitReqs, new ParallelOptions { MaxDegreeOfParallelism = threads }, (IGrouping<int, T> rs) =>
            {
                var req = new ExecuteMultipleRequest
                {
                    Requests = new OrganizationRequestCollection()
                };
                req.Requests.AddRange(rs);
                req.Settings = new ExecuteMultipleSettings
                {
                    ContinueOnError = continueOnError,
                    ReturnResponses = true
                };

                if (skipPlugins)
                {
                    req.Parameters.Add("BypassCustomPluginExecution", true);
                    req.Parameters.Add("SuppressCallbackRegistrationExpanderJob", true);
                }

                Interlocked.Increment(ref execNo);
                if (writeStatusToConsole)
                {
                    Console.WriteLine($"Executing batch {execNo}/{count}");
                }

                var resp = service.Execute(req) as ExecuteMultipleResponse;
                resps.AddRange(resp.Responses);
            });
            return resps;
        }
    }
}
