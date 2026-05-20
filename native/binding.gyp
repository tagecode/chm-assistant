{
  "targets": [
    {
      "target_name": "chm_addon",
      "sources": [
        "src/addon.cc",
        "third_party/chmlib/src/chm_lib.c",
        "third_party/chmlib/src/lzx.c"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "third_party/chmlib/src"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "11.0",
        "OTHER_CFLAGS": [
          "-Wno-macro-redefined",
          "-Wno-unterminated-string-initialization",
          "-Wno-sign-compare",
          "-Wno-unused-const-variable"
        ]
      },
      "msvs_settings": {
        "VCCLCompilerTool": { "ExceptionHandling": 1 }
      },
      "conditions": [
        [
          "OS!='win'",
          {
            "cflags": [
              "-Wno-macro-redefined",
              "-Wno-unterminated-string-initialization",
              "-Wno-sign-compare",
              "-Wno-unused-const-variable"
            ]
          }
        ],
        [
          "OS=='linux'",
          {
            "defines": ["CHM_MT", "CHM_USE_PREAD", "CHM_USE_IO64"],
            "link_settings": { "libraries": ["-pthread"] }
          }
        ],
        ["OS=='mac'", { "defines": ["CHM_MT"], "link_settings": { "libraries": ["-pthread"] } }],
        ["OS=='win'", { "defines": ["CHM_MT", "WIN32"] }]
      ]
    }
  ]
}
