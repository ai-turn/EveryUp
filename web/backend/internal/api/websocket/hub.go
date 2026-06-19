package websocket

import (
	"encoding/json"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	"github.com/aiturn/everyup/internal/crypto"
)

// Client represents a WebSocket client
type Client struct {
	conn *websocket.Conn
	send chan []byte
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("WebSocket client connected. Total: %d", len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("WebSocket client disconnected. Total: %d", len(h.clients))

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Broadcast sends a message to all connected clients
func (h *Hub) Broadcast(data interface{}) {
	message, err := json.Marshal(data)
	if err != nil {
		log.Printf("Failed to marshal broadcast message: %v", err)
		return
	}

	select {
	case h.broadcast <- message:
	default:
		log.Println("Broadcast channel full, dropping message")
	}
}

// GetBroadcastFunc returns a function that can be used to broadcast messages
func (h *Hub) GetBroadcastFunc() func(interface{}) {
	return h.Broadcast
}

// ClientCount returns the number of connected clients
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// WebSocketUpgrade returns middleware to check if request can be upgraded.
// It validates JWT from the ?token= query parameter or Authorization header.
func WebSocketUpgrade() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !websocket.IsWebSocketUpgrade(c) {
			return fiber.ErrUpgradeRequired
		}

		// Extract JWT from query param or Authorization header
		token := c.Query("token")
		if token == "" {
			auth := c.Get("Authorization")
			if strings.HasPrefix(auth, "Bearer ") {
				token = auth[7:]
			}
		}

		if token == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "UNAUTHORIZED",
					"message": "WebSocket connection requires authentication. Provide ?token=<jwt> query parameter.",
				},
			})
		}

		claims, err := crypto.VerifyToken(token)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"error": fiber.Map{
					"code":    "UNAUTHORIZED",
					"message": "Token is expired or invalid",
				},
			})
		}

		c.Locals("allowed", true)
		c.Locals("claims", claims)
		return c.Next()
	}
}

// Handler returns the WebSocket handler
func (h *Hub) Handler() fiber.Handler {
	return websocket.New(func(c *websocket.Conn) {
		client := &Client{
			conn: c,
			send: make(chan []byte, 256),
		}

		h.register <- client

		// Start writer goroutine
		go func() {
			ticker := time.NewTicker(30 * time.Second)
			defer ticker.Stop()

			for {
				select {
				case message, ok := <-client.send:
					if !ok {
						c.WriteMessage(websocket.CloseMessage, []byte{})
						return
					}
					if err := c.WriteMessage(websocket.TextMessage, message); err != nil {
						return
					}
				case <-ticker.C:
					// Send ping to keep connection alive
					if err := c.WriteMessage(websocket.PingMessage, nil); err != nil {
						return
					}
				}
			}
		}()

		// Read messages (mainly for keepalive pong responses)
		for {
			_, _, err := c.ReadMessage()
			if err != nil {
				break
			}
		}

		h.unregister <- client
	})
}
