using System;
using Xrm.Application.Events;
using Xrm.Application.Queries;
using Xrm.Domain.Attributes;
using Xrm.Domain.Flow;
using Xrm.Domain.Interfaces;

namespace Xrm.Application.Commands
{
    public class LoadSettings : ICommand
    {
        public Guid UserId { get; set; }

        [Output]
        public string Settings { get; internal set; }

        public class Handler : CommandHandler<LoadSettings>
        {
            private readonly NoteQueries noteQueries;

            public Handler(FlowArguments flowArgs, NoteQueries noteQueries) : base(flowArgs)
            {
                this.noteQueries = noteQueries ?? throw new ArgumentNullException(nameof(noteQueries));
            }

            public override VoidEvent Execute(LoadSettings command)
            {
                string noteSubject = SettingsHelper.GetNoteSubject(command.UserId);

                command.Settings = noteQueries.GetBodyText(noteSubject);

                return VoidEvent;
            }
        }
    }
}
