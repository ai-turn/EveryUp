package handlers

import (
	"database/sql"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/database"
	"golang.org/x/crypto/bcrypt"
)

// setAuthCookie sets a secure httpOnly JWT cookie on the response.
func setAuthCookie(c *fiber.Ctx, token string) {
	c.Cookie(&fiber.Cookie{
		Name:     "jwt_token",
		Value:    token,
		HTTPOnly: true,
		Secure:   c.Protocol() == "https",
		SameSite: "Lax",
		Path:     "/",
		MaxAge:   int((7 * 24 * time.Hour).Seconds()),
	})
}

// clearAuthCookie clears the JWT cookie.
func clearAuthCookie(c *fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     "jwt_token",
		Value:    "",
		HTTPOnly: true,
		Secure:   c.Protocol() == "https",
		SameSite: "Lax",
		Path:     "/",
		MaxAge:   -1,
	})
}

// AuthHandler handles authentication endpoints.
type AuthHandler struct{}

func NewAuthHandler() *AuthHandler { return &AuthHandler{} }

// SetupStatus reports whether the first-run setup has been completed.
// GET /auth/setup/status  (public)
func (h *AuthHandler) SetupStatus(c *fiber.Ctx) error {
	repo := database.NewUserRepository()
	count, err := repo.Count()
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	return c.JSON(fiber.Map{
		"success": true,
		"data":    fiber.Map{"needs_setup": count == 0},
	})
}

// Setup creates the first admin account.
// POST /auth/setup  (public, but rejected if a user already exists)
func (h *AuthHandler) Setup(c *fiber.Ctx) error {
	repo := database.NewUserRepository()

	count, err := repo.Count()
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	if count > 0 {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "ALREADY_SETUP", "message": "Setup has already been completed"},
		})
	}

	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&body); err != nil || body.Username == "" || body.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_INPUT", "message": "username and password are required"},
		})
	}
	if len(body.Password) < 8 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_INPUT", "message": "password must be at least 8 characters"},
		})
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "HASH_ERROR", "message": "failed to hash password"},
		})
	}

	user, err := repo.Create(body.Username, string(hash), "admin")
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}

	token, err := crypto.SignToken(crypto.UserClaims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "TOKEN_ERROR", "message": "failed to sign token"},
		})
	}

	setAuthCookie(c, token)
	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"user_id":  user.ID,
			"username": user.Username,
			"role":     user.Role,
		},
	})
}

// Login authenticates a user and returns a JWT.
// POST /auth/login  (public)
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&body); err != nil || body.Username == "" || body.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_INPUT", "message": "username and password are required"},
		})
	}

	repo := database.NewUserRepository()
	user, err := repo.FindByUsername(body.Username)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_CREDENTIALS", "message": "Invalid username or password"},
		})
	}
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(body.Password)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "INVALID_CREDENTIALS", "message": "Invalid username or password"},
		})
	}

	token, err := crypto.SignToken(crypto.UserClaims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "TOKEN_ERROR", "message": "failed to sign token"},
		})
	}

	setAuthCookie(c, token)
	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"user_id":  user.ID,
			"username": user.Username,
			"role":     user.Role,
		},
	})
}

// Logout clears the JWT cookie.
// POST /auth/logout  (public)
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	clearAuthCookie(c)
	return c.JSON(fiber.Map{"success": true})
}

// Verify confirms the JWT is valid.
// GET /auth/verify  (protected)
func (h *AuthHandler) Verify(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"success": true})
}

// Me returns the user info embedded in the JWT.
// GET /auth/me  (protected)
func (h *AuthHandler) Me(c *fiber.Ctx) error {
	claims := c.Locals("claims").(*crypto.UserClaims)
	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"user_id":  claims.UserID,
			"username": claims.Username,
			"role":     claims.Role,
		},
	})
}

// Reset deletes all users and rotates the JWT secret, returning the app to first-run state.
// POST /auth/reset  (protected)
func (h *AuthHandler) Reset(c *fiber.Ctx) error {
	repo := database.NewUserRepository()
	if err := repo.DeleteAll(); err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}

	if err := crypto.RotateSecret(database.DB); err != nil {
		return internalError(c, "SECRET_ERROR", err)
	}

	// Clear the caller's JWT cookie — the rotated secret invalidates all tokens,
	// but the stale cookie would cause repeated 401s until it expires.
	clearAuthCookie(c)

	return c.JSON(fiber.Map{"success": true})
}
