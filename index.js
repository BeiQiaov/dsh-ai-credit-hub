/**
 * Host half of the AI credit hub.
 *
 * The plugin is a browser-only surface: it reads the read-only status routes the
 * installed connector plugins already publish (`/plugins/<connector>/...`) and
 * never touches credentials, the network, or model state on its own. This entry
 * exists so the Loader row is a real plugin; it registers nothing.
 */
export function apply() {}