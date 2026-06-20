# Homebrew formula for mdsite — installs the prebuilt standalone binary, so
# it does NOT depend on Node. Distribute it via a tap:
#
#   1. Create a public repo:  THANSHEER/homebrew-tap
#   2. Put this file at:      Formula/mdsite.rb   (sha256s filled by a release)
#   3. Users install with:    brew install THANSHEER/tap/mdsite
#
# scripts/update-formula.mjs rewrites `version` and the four `sha256` lines from
# the release tarballs (the release CI does this automatically).
class Mdsite < Formula
  desc "Turn a folder of Markdown notes into a fast static website"
  homepage "https://github.com/THANSHEER/mdsite"
  version "0.1.0"
  license "GPL-3.0-or-later"

  on_macos do
    on_arm do
      url "https://github.com/THANSHEER/mdsite/releases/download/v0.1.0/mdsite-darwin-arm64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
    on_intel do
      url "https://github.com/THANSHEER/mdsite/releases/download/v0.1.0/mdsite-darwin-x64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/THANSHEER/mdsite/releases/download/v0.1.0/mdsite-linux-arm64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
    on_intel do
      url "https://github.com/THANSHEER/mdsite/releases/download/v0.1.0/mdsite-linux-x64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
  end

  def install
    bin.install "mdsite"
  end

  test do
    assert_match "mdsite/", shell_output("#{bin}/mdsite --version")
  end
end
