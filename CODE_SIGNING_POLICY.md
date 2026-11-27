# X CLIENT — Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

> Status: the project is applying to the SignPath Foundation open-source program. Until the application is approved and integrated, Windows release artifacts may be unsigned. X CLIENT will not represent an artifact as SignPath-signed before that.

## What is signed

Only binaries built from this repository's own source code:

- `XClient.exe` / `XCLauncher.exe` — built from `xclient_launcher.c` and `xc_*.c`;
- `X-Client-Setup.exe` — the NSIS installer built from `installer.nsi`.

Third-party files (Counter-Strike 1.6 / Half-Life game files, nDirect / NextClient files) are **not** signed by this project. The launcher downloads the game separately; those files keep their upstream status. See [NOTICE.md](NOTICE.md).

## Source and build provenance

- Source repository: https://github.com/jamic2922220-alt/xclient-pc
- Releases are built by GitHub Actions on GitHub-hosted runners (`.github/workflows/build_x_client.yml`) directly from the repository source.
- Signing requests may only originate from that workflow.

## Roles

The project is maintained by an individual maintainer.

- Committer and reviewer: [jamic2922220-alt](https://github.com/jamic2922220-alt)
- Signing approver: [jamic2922220-alt](https://github.com/jamic2922220-alt)

Every production signing request is approved manually by the approver. Multi-factor authentication is required for the maintainer on GitHub and SignPath.

## Privacy

The launcher sends some data to mmb.boost-top.com. Statistics and error reports can be disabled by the user. See [PRIVACY.txt](PRIVACY.txt); the same text is shown during installation.

## System changes

The launcher may create a Windows Firewall rule for the game, enable TLS 1.2 for the current user on Windows 7, and set compatibility flags on game files. These are documented in [PRIVACY.txt](PRIVACY.txt). An uninstaller is provided (`XClient-Uninstall.exe`, also in "Apps & features").

## Compromise handling

If a signed artifact, the release workflow, the maintainer account or a signing request is suspected to be compromised, signing and publishing are stopped, the incident is investigated, SignPath Foundation is notified and certificate revocation is requested when appropriate.
