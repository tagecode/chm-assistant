; Custom NSIS include for CHM Assistant (electron-builder).
; Runs in the generated script header before common.nsh, so VERSION is prefixed
; for installer branding and Add/Remove Programs DisplayVersion.

!ifndef CHM_ASSISTANT_VERSION_PREFIXED
  !define CHM_ASSISTANT_VERSION_PREFIXED
  !define _CHM_ASSISTANT_RAW_VERSION "${VERSION}"
  !undef VERSION
  !define VERSION "v${_CHM_ASSISTANT_RAW_VERSION}"
!endif
