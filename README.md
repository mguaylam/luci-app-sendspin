# luci-app-sendspin

A LuCI web interface for [`sendspin-cli`](https://github.com/Sendspin/sendspin-cpp-cli),
the Sendspin player packaged for OpenWrt in
[mguaylam/openwrt-sendspin](https://github.com/mguaylam/openwrt-sendspin).

> **Status: experimental.** Built and tested on a D-Link DIR-3040 running
> OpenWrt 25.12.5, alongside the package it configures.

## What it does

Under *Services → Sendspin*:

- **Status** of each player, refreshed every five seconds: whether it runs,
  the server it is connected to, playback state, track, volume and output.
  The same summary appears on the *Status → Overview* page.
- **Controls** for a player connected to a server: previous, play or pause,
  stop, next, group volume and mute, repeat and shuffle. They act on the
  player's group, through the server, and need write access in LuCI.
- **Settings** for `/etc/config/sendspin-cli`: enabling the player, its name,
  the output device (playback devices found in `/proc/asound` are offered),
  the preferred format, and under *Advanced Settings* the buffer, static
  delay, port, mDNS announcement, server address, log level and state
  directory. Saving restarts the player.

Everything goes through `rpcd`, as granted in
`root/usr/share/rpcd/acl.d/luci-app-sendspin.json`: reading the service list,
the two `/proc/asound` files and `sendspin-cli status`; and, with write access,
the `sendspin-cli` control subcommands above, all on the players' control
sockets in `/var/run/sendspin-cli/`.

Cover art is not shown: the Sendspin metadata carries an artwork URL, but
`sendspin-cli status` does not print it.

Translations: English, plus Czech, Dutch, French, German, Italian, Japanese,
Korean, Polish, Portuguese (Brazil), Russian, Simplified and Traditional
Chinese, Spanish, Swedish, Turkish and Ukrainian. **None has been reviewed by
a native speaker**; corrections are very welcome, and a pull request touching
a single `po/<lang>/sendspin.po` is the easiest way to send one.

## Installing

Add both feeds to `feeds.conf` in an OpenWrt SDK or buildroot:

```
src-git sendspin https://github.com/mguaylam/openwrt-sendspin.git
src-git luci_sendspin https://github.com/mguaylam/luci-app-sendspin.git
```

then:

```sh
./scripts/feeds update sendspin luci_sendspin
./scripts/feeds install -p luci_sendspin luci-app-sendspin
make package/luci-app-sendspin/compile
```

The package depends on `luci-base` and `sendspin-cli`. Translations are
built as separate `luci-i18n-sendspin-<language>` packages.

After installing, log out of LuCI and back in: the menu and permissions of a
session are fixed when it starts, so *Services → Sendspin* only appears in a
new one.

## Layout

The app lives in `applications/luci-app-sendspin/`, as in
[openwrt/luci](https://github.com/openwrt/luci), so it can move there
unchanged apart from the `luci.mk` include in its Makefile.

## Continuous integration

Every pull request checks the JavaScript, JSON and translation files, and
builds the package with the OpenWrt SDK against 25.12.5 and the snapshot,
with the `openwrt-sendspin` feed added for `sendspin-cli`.

## License

Apache-2.0, like the applications in openwrt/luci — see [LICENSE](LICENSE).
