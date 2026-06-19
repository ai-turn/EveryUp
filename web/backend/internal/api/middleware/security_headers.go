package middleware

import (
	"github.com/gofiber/fiber/v2"
)

// SecurityHeaders adds security-related HTTP response headers to every response.
// Includes X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and CSP.
// HSTS is only set when running behind HTTPS (detected via X-Forwarded-Proto or protocol).
func SecurityHeaders(mode string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Prevent clickjacking
		c.Set("X-Frame-Options", "DENY")

		// Prevent MIME-type sniffing
		c.Set("X-Content-Type-Options", "nosniff")

		// Control referrer information
		c.Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// Prevent IE from executing downloads in site context
		c.Set("X-Download-Options", "noopen")

		// Basic XSS protection for legacy browsers
		c.Set("X-XSS-Protection", "1; mode=block")

		// Content Security Policy
		// - default-src 'self': only allow same origin by default
		// - script-src 'self': no inline scripts
		// - style-src 'self' 'unsafe-inline': Tailwind requires inline styles
		// - img-src 'self' data:: allow data URIs for icons/avatars
		// - connect-src 'self' ws: wss:: allow WebSocket connections
		// - font-src 'self': allow same-origin fonts
		// - object-src 'none': block Flash/plugins
		// - base-uri 'self': prevent base tag hijacking
		// - frame-ancestors 'none': redundant with X-Frame-Options but belt-and-suspenders
		c.Set("Content-Security-Policy",
			"default-src 'self'; "+
				"script-src 'self'; "+
				"style-src 'self' 'unsafe-inline'; "+
				"img-src 'self' data: blob:; "+
				"connect-src 'self' ws: wss:; "+
				"font-src 'self' data:; "+
				"object-src 'none'; "+
				"base-uri 'self'; "+
				"frame-ancestors 'none'",
		)

		// HSTS: only set when behind HTTPS
		proto := c.Get("X-Forwarded-Proto")
		if proto == "https" || c.Protocol() == "https" {
			c.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		// Remove server fingerprint header set by Fiber
		c.Set("Server", "")

		return c.Next()
	}
}
