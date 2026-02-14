{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    (python3.withPackages (ps: [ ps.pillow ]))  # BLP → PNG (Pillow has native BLP support)
    libwebp                                      # cwebp (PNG → WebP)
  ];

  shellHook = ''
    echo "BLP → WebP conversion tools available:"
    echo "  python + pillow: $(python --version)"
    echo "  cwebp: $(cwebp -version 2>&1 | head -1)"
    echo ""
    echo "Run: ./convert-blp.sh"
  '';
}
