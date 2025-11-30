package server

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"otter/internal/store"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	Username  string `json:"username"`
	TokenType string `json:"token_type"` // "access" or "refresh"
	jwt.RegisteredClaims
}

// TokenResponse represents the response for token generation

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"` // Access token expiration in seconds
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	user, err := s.store.GetUser(r.Context(), req.Username)
	if err != nil {
		if err == store.ErrNotFound {
			http.Error(w, "invalid credentials", http.StatusUnauthorized)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	// In a real app, compare hashed password
	if user.Password != req.Password {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	// Generate access token and refresh token
	accessToken, refreshToken, expiresIn, err := s.generateTokens(user.Username)
	if err != nil {
		http.Error(w, "failed to generate tokens", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    expiresIn,
	})
}

// generateTokens generates both access token and refresh token

func (s *Server) generateTokens(username string) (accessToken, refreshToken string, expiresIn int64, err error) {
	// Access token: expires in 2 hours
	accessExpiration := time.Now().Add(2 * time.Hour)
	accessClaims := &Claims{
		Username:  username,
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(accessExpiration),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   username,
		},
	}

	accessToken, err = jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims).SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", "", 0, err
	}

	// Refresh token: expires in 7 days
	refreshExpiration := time.Now().Add(7 * 24 * time.Hour)
	refreshClaims := &Claims{
		Username:  username,
		TokenType: "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(refreshExpiration),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   username,
		},
	}

	refreshToken, err = jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims).SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", "", 0, err
	}

	// ExpiresIn in seconds
	expiresIn = int64(2 * time.Hour / time.Second)

	return accessToken, refreshToken, expiresIn, nil
}

// refreshTokenHandler handles token refresh requests
func (s *Server) refreshTokenHandler(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	// Parse and validate refresh token
	refreshClaims := &Claims{}
	token, err := jwt.ParseWithClaims(req.RefreshToken, refreshClaims, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.jwtSecret), nil
	})

	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
		return
	}

	// Check if it's a refresh token
	if refreshClaims.TokenType != "refresh" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token type"})
		return
	}

	// Generate new access token and refresh token
	accessToken, newRefreshToken, expiresIn, err := s.generateTokens(refreshClaims.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate tokens"})
		return
	}

	c.JSON(http.StatusOK, TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		ExpiresIn:    expiresIn,
	})
}

func (s *Server) authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "authorization header required", http.StatusUnauthorized)
			return
		}

		bearerToken := strings.Split(authHeader, " ")
		if len(bearerToken) != 2 {
			http.Error(w, "invalid token format", http.StatusUnauthorized)
			return
		}

		tokenStr := bearerToken[1]

		// Check if token is blacklisted
		isBlacklisted, err := s.store.IsTokenBlacklisted(r.Context(), tokenStr)
		if err != nil {
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		if isBlacklisted {
			http.Error(w, "token has been revoked", http.StatusUnauthorized)
			return
		}

		// Check token rate limit
		// Allow 100 requests per minute per token
		allowed, err := s.store.CheckTokenRateLimit(r.Context(), tokenStr, 100, 1*time.Minute)
		if err != nil {
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		if !allowed {
			http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
			return
		}

		// Increment token usage
		_, err = s.store.IncrementTokenUsage(r.Context(), tokenStr)
		if err != nil {
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(s.jwtSecret), nil
		})

		if err != nil || !token.Valid {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		// Check if it's an access token
		if claims.TokenType != "access" {
			http.Error(w, "invalid token type", http.StatusUnauthorized)
			return
		}

		// Add username to context if needed
		ctx := context.WithValue(r.Context(), "username", claims.Username)
		next(w, r.WithContext(ctx))
	}
}
