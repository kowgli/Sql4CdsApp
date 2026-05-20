using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using Xrm.Domain.Interfaces;

namespace Xrm.Infrastructure
{
    public class DisabledCommands
    {

#pragma warning disable S125
        /*
        * Sample config:
        * {
        *      "disabledCommands": [
        *          "Xrm.Application.Commands.BrokerFeeSetting.DoNotAllowDuplicateBrokerFeeSettingsInSameAccount",
        *          "Xrm.Application.Commands.PriceAgreementInheritance.DoNotAllowPriceAgreementCoverageNotFromInsureanceProduct",
        *          "Xrm.Application.Commands.PriceAgreementInheritance.LockPriceAgreementsRegardingEditingWhenInUseOnCoveragePrice"
        *      ]
        * }
        */
#pragma warning restore S125

        [DataContract]

        public class DisabledCommandSettings
        {
            [DataMember(Name = "disabledCommands")]
            public string[] DisabledCommands { get; set; }
        }

        private readonly HashSet<string> disabledCommands = new HashSet<string>();

        public DisabledCommands(string configJson)
        {
            if (string.IsNullOrWhiteSpace(configJson)) { return; }

            DisabledCommandSettings settings = new JsonHelper.JsonHelper().Deserialize<DisabledCommandSettings>(configJson);

            string[] distinctCommands = settings.DisabledCommands
                                                .Where(c => !string.IsNullOrWhiteSpace(c))
                                                .Select(c => c.Trim())
                                                .Distinct()
                                                .ToArray();

            foreach (string command in distinctCommands)
            {
                disabledCommands.Add(command);
            }
        }

        public bool IsDisabled(ICommand command)
        {
            if (command == null) { return true; }

            return IsDisabled(command.GetType().FullName);
        }

        public bool IsDisabled(Type type)
        {
            if (type == null) { return true; }

            return IsDisabled(type.FullName);
        }

        public bool IsDisabled(string typeFullName)
        {
            if (string.IsNullOrWhiteSpace(typeFullName)) { return true; }

            return disabledCommands.Contains(typeFullName);
        }
    }
}
