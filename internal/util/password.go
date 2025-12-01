package util

import (
	"crypto/md5"
	"encoding/hex"
)

// MD5Encrypt encrypts a password using MD5 algorithm
func MD5Encrypt(password string) string {
	hash := md5.Sum([]byte(password))
	return hex.EncodeToString(hash[:])
}

// CheckPassword checks if the provided password matches the hashed password
func CheckPassword(providedPassword, hashedPassword string) bool {
	return MD5Encrypt(providedPassword) == hashedPassword
}
