using Microsoft.Xrm.Sdk;
using System;
using System.Linq;
using Xrm.Domain.Crm;

namespace Xrm.Application.Queries
{
    public class NoteQueries : CrmQuery<Annotation>
    {
        public NoteQueries(IOrganizationService orgService) : base(orgService)
        {
        }

        public Guid? FindBySubject(string subject)
        {
            using XrmContext xrm = new XrmContext(OrgService);

            return xrm.AnnotationSet.Where(a => a.Subject == subject).Select(a => a.AnnotationId).FirstOrDefault();
        }

        public string GetBodyText(string subject)
        {
            using XrmContext xrm = new XrmContext(OrgService);

            string body = xrm.AnnotationSet.Where(a => a.Subject == subject).Select(a => a.DocumentBody).FirstOrDefault();

            if (body == null) { return null; }

            string noteTextUtf8 = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(body));

            return noteTextUtf8;
        }
    }
}
