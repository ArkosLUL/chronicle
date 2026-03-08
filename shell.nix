{ pkgs ? import <nixpkgs> {} }:

let
  # System libraries required by Playwright's bundled Chromium.
  # Without these on LD_LIBRARY_PATH, the headless shell exits with
  # "error while loading shared libraries: libnspr4.so …" (or similar).
  playwrightDeps = with pkgs; [
    # Core browser engine deps
    nss
    nspr
    atk
    cups
    libdrm
    mesa
    expat
    alsa-lib
    pango
    cairo
    glib
    gtk3
    dbus

    # X11 libs
    xorg.libX11
    xorg.libXcomposite
    xorg.libXdamage
    xorg.libXext
    xorg.libXfixes
    xorg.libXrandr
    xorg.libxcb

    # Additional libs Chromium may need
    at-spi2-atk
    libxkbcommon
    xorg.libXcursor
    xorg.libXi
    xorg.libXrender
    xorg.libXScrnSaver
    xorg.libXtst
    xorg.libxshmfence
    libgbm
  ];
in
pkgs.mkShell {
  buildInputs = with pkgs; [
    # Go
    go_1_25
    golangci-lint
    gotestsum
    sqlc

    # Node.js / Frontend
    nodejs_20
    pnpm_10

    # Database (client tools: createdb, pg_isready, psql, …)
    postgresql_17

    # Build tools
    gnumake
    git
  ] ++ playwrightDeps;

  shellHook = ''
    # Let Playwright's self-managed Chromium find Nix-provided system libs.
    export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath playwrightDeps}''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

    # Skip Playwright's host-requirements check (it looks for dpkg/apt
    # metadata which doesn't exist on NixOS / nix-shell).
    export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
  '';
}
