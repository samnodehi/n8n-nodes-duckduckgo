# Security Policy

## Supported Versions

Only the latest published version of `n8n-nodes-duckduckgo-search` on npm
receives security updates. Please upgrade to the latest release before
reporting an issue.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report privately via one of:

- GitHub **private vulnerability reporting**: the repository's **Security**
  tab → **Report a vulnerability**.
- Email: **sam.noodehi@gmail.com**

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce (a minimal workflow or query, if applicable)
- The affected version of the node and your n8n version

You can expect an initial acknowledgement within **7 days**. Once confirmed,
a fix will be released as soon as practical and the report credited unless
you prefer to remain anonymous.

## Scope notes

This node sends search requests directly to DuckDuckGo's public endpoints.
It registers no credentials, stores nothing on disk, and sends no telemetry.
Reports about query or result data leaving the node to any destination other
than DuckDuckGo are especially welcome.
