using System;
using System.Text;
using Xrm.Application.Events;
using Xrm.Application.Queries;
using Xrm.Domain.Crm;
using Xrm.Domain.Flow;
using Xrm.Domain.Interfaces;

namespace Xrm.Application.Commands
{
    public class SaveSettings : ICommand
    {
        public Guid UserId { get; set; }
        public string Settings { get; set; }

        public class Handler : CommandHandler<SaveSettings>
        {
            private readonly NoteQueries noteQueries;

            public Handler(FlowArguments flowArgs, NoteQueries noteQueries) : base(flowArgs)
            {
                this.noteQueries = noteQueries ?? throw new ArgumentNullException(nameof(noteQueries));
            }

            public override VoidEvent Execute(SaveSettings command)
            {
                string noteSubject = SettingsHelper.GetNoteSubject(command.UserId);

                Guid? existingNoteId = noteQueries.FindBySubject(noteSubject);

                Annotation settingsNote = new Annotation
                {
                    DocumentBody = command.Settings != null ? Convert.ToBase64String(Encoding.UTF8.GetBytes(command.Settings)) : null,
                };

                if (existingNoteId != null)
                {
                    settingsNote.AnnotationId = existingNoteId.Value;

                    OrgServiceWrapper.OrgServiceAsSystem.Update(settingsNote);
                }
                else
                {
                    settingsNote.Subject = noteSubject;

                    OrgServiceWrapper.OrgServiceAsSystem.Create(settingsNote);
                }

                return VoidEvent;
            }
        }
    }
}
