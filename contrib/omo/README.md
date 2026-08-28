# OmO session claims

Collie can render persisted OmO turns above the live terminal when OmO reports the exact session
file owned by a Herdr pane. Install the bundled extension in OmO's agent directory:

```bash
mkdir -p ~/.omo/agent/extensions
cp contrib/omo/herdr-collie-session.ts ~/.omo/agent/extensions/
```

Then configure Collie with the directory that contains OmO's session folders:

```dotenv
COLLIE_OMO_ROOT=/Users/you/.omo/agent/sessions
```

Restart both the OmO pane and Collie. The extension writes an atomic claim under
`~/.omo/agent/herdr-sessions/`; Collie accepts it only while the reporting PID is still a foreground
process of the claimed pane.
