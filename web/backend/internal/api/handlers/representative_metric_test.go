package handlers

import (
	"testing"

	"github.com/aiturn/everyup/internal/models"
)

func TestPickRepresentativeMetric(t *testing.T) {
	m := func(name string) models.OtelServiceMetric {
		return models.OtelServiceMetric{MetricName: name, Value: 1}
	}

	tests := []struct {
		name    string
		metrics []models.OtelServiceMetric
		want    string // expected MetricName, "" = no match
	}{
		{"queue wins over cpu/memory", []models.OtelServiceMetric{m("container.cpu.utilization"), m("queue.messages.pending"), m("container.memory.usage")}, "queue.messages.pending"},
		{"connection over memory", []models.OtelServiceMetric{m("db.client.connections.usage"), m("container.memory.usage")}, "db.client.connections.usage"},
		{"memory over cpu", []models.OtelServiceMetric{m("container.cpu.utilization"), m("redis.memory.used")}, "redis.memory.used"},
		{"cpu is last resort", []models.OtelServiceMetric{m("http.server.duration"), m("container.cpu.utilization")}, "container.cpu.utilization"},
		{"case-insensitive", []models.OtelServiceMetric{m("JVM.Memory.Used")}, "JVM.Memory.Used"},
		{"no representative", []models.OtelServiceMetric{m("http.server.duration"), m("some.custom.gauge")}, ""},
		{"empty", nil, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := pickRepresentativeMetric(tt.metrics)
			if tt.want == "" {
				if ok {
					t.Fatalf("expected no match, got %q", got.MetricName)
				}
				return
			}
			if !ok || got.MetricName != tt.want {
				t.Fatalf("got %q (ok=%v), want %q", got.MetricName, ok, tt.want)
			}
		})
	}
}
