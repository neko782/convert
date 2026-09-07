# Upstream's Makefile with the emscripten configuration selected, plus the
# module options the libopenmpt handler relies on. Variables must be appended
# after the include: passing LDFLAGS on the make command line would replace
# upstream's flags instead of extending them.
CONFIG = emscripten
EMSCRIPTEN_TARGET = wasm
STDC = c17
STDCXX = c++20
include Makefile

LDFLAGS += -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker
LDFLAGS += -sEXPORTED_RUNTIME_METHODS=HEAPU8,HEAP16
