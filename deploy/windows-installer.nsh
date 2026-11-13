; Bundle the same public CA used by Android. Windows asks the current user to trust it.
!macro customInstall
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File /oname=factory-ca.crt "${PROJECT_DIR}\..\android\res\raw\factory_ca.crt"
  nsExec::ExecToStack '"$SYSDIR\certutil.exe" -user -addstore Root "$PLUGINSDIR\factory-ca.crt"'
  Pop $0
  Pop $1
  Delete "$PLUGINSDIR\factory-ca.crt"
  SetOutPath "$INSTDIR"
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP "Factory certificate setup failed or was declined. Run this installer again and accept the Windows certificate prompt before opening Mould Tracker."
    SetErrorLevel 1
    Quit
  ${EndIf}
!macroend
