# Third-Party Notices — DDRenamer

DDRenamer itself is MIT (see `LICENSE`). The distributed application embeds
the components below, and their notices have to travel with the binary.

> 🤖 The dependency tables are generated from `cargo metadata` and
> `package.json`, not written by hand. Regenerate them after changing
> dependencies -- a notices file that has drifted is worse than none,
> because it looks like somebody checked.

## Fonts — embedded in the binary (SIL Open Font License 1.1)

These are why this file is mandatory rather than polite: the woff2 files are
compiled into the application, so distributing DDRenamer distributes the fonts.

- **Noto Sans JP Variable** — Copyright Google Inc.
- **JetBrains Mono Variable** — Copyright 2020 The JetBrains Mono Project Authors
  (https://github.com/JetBrains/JetBrainsMono)

Both are licensed under the SIL Open Font License, Version 1.1, reproduced in
full at the end of this file.

## Frontend dependencies

| Package | License |
|---|---|
| `@fontsource-variable/jetbrains-mono` | OFL-1.1 |
| `@fontsource-variable/noto-sans-jp` | OFL-1.1 |
| `@tauri-apps/api` | Apache-2.0 OR MIT |
| `@tauri-apps/plugin-opener` | MIT OR Apache-2.0 |
| `i18next` | MIT |
| `lucide-react` | ISC |
| `react` | MIT |
| `react-dom` | MIT |
| `react-i18next` | MIT |
| `tauri-plugin-clipboard-x-api` | MIT |

## Rust dependencies (463 crates)

Every crate in the tree declares a license, none is undeclared, and there is
no GPL anywhere in it. Equivalent spellings of the same choice (`MIT/Apache-2.0`
and `MIT OR Apache-2.0`) are folded onto one row.

| License | Crates |
|---|---|
| Apache-2.0 OR MIT | 258 |
| MIT | 116 |
| Apache-2.0 OR MIT OR Zlib | 21 |
| Unicode-3.0 | 18 |
| Apache-2.0 OR Apache-2.0 WITH LLVM-exception OR MIT | 14 |
| MIT OR Unlicense | 7 |
| MPL-2.0 | 5 |
| Apache-2.0 | 3 |
| BSL-1.0 | 3 |
| Apache-2.0 OR BSD-2-Clause OR MIT | 2 |
| Apache-2.0 OR BSD-3-Clause | 2 |
| Apache-2.0 OR BSD-3-Clause OR MIT | 2 |
| BSD-3-Clause | 2 |
| (MIT OR Apache-2.0) AND Unicode-3.0 | 1 |
| 0BSD OR Apache-2.0 OR MIT | 1 |
| Apache-2.0 AND MIT | 1 |
| Apache-2.0 OR CC0-1.0 OR MIT-0 | 1 |
| Apache-2.0 OR LGPL-2.1-or-later OR MIT | 1 |
| Apache-2.0 WITH LLVM-exception | 1 |
| BSD-3-Clause AND MIT | 1 |
| BSD-3-Clause OR MIT | 1 |
| ISC | 1 |
| Zlib | 1 |

### Weak copyleft present (MPL-2.0)

Used unmodified, as dependencies. MPL-2.0 is file-level copyleft: it does not
change the license of DDRenamer, but recipients are entitled to the source of
these files, which is published upstream on crates.io.

- `cssparser` — https://crates.io/crates/cssparser
- `cssparser-macros` — https://crates.io/crates/cssparser-macros
- `dtoa-short` — https://crates.io/crates/dtoa-short
- `option-ext` — https://crates.io/crates/option-ext
- `selectors` — https://crates.io/crates/selectors

### Boost Software License 1.0

Permissive and requires no notice in binary form; listed for completeness.
(Windows-only crates, pulled in by the clipboard plugin.)

- `clipboard-win`
- `error-code`
- `windows-win`

## System libraries

On Linux the application links against the platform WebKitGTK / GTK stack
(LGPL), which is **not** bundled -- it comes from the operating system. On
macOS it uses the system WKWebView.

---

## SIL Open Font License, Version 1.1

```
This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```
