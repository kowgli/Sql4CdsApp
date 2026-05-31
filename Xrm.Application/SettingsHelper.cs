using System;

namespace Xrm.Application
{
    public static class SettingsHelper
    {
        public static string GetNoteSubject(Guid userId)
        {
            return $"Sql4CdsApp_Settings_{userId:N}";
        }
    }
}
