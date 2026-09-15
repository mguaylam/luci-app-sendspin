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
- **Settings** for `/etc/config/sendspin-cli`: enabling the player, its name,
  the output device (playback devices found in `/proc/asound` are offered),
  the preferred format, and under *Advanced Settings* the buffer, static
  delay, port, mDNS announcement, server address, log level and state
  directory. Saving restarts the player.

The interface reads status through `rpcd` only: the service list, the two
`/proc/asound` files, and `sendspin-cli status` on the players' control
sockets, as granted in `root/usr/share/rpcd/acl.d/luci-app-sendspin.json`.

Translations: English, French, German and Spanish. None has been reviewed by
a native speaker yet; corrections are welcome.

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
