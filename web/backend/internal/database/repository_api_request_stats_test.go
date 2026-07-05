package database

import "testing"

func TestPercentile(t *testing.T) {
	cases := []struct {
		vals []int
		p    int
		want int
	}{
		{nil, 50, 0},
		{[]int{10}, 50, 10},
		{[]int{10}, 95, 10},
		{[]int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, 50, 5},   // ceil(0.5*10)=5 -> sorted[4]=5
		{[]int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, 95, 10},  // ceil(0.95*10)=10 -> sorted[9]=10
		{[]int{5, 1, 3, 2, 4}, 50, 3},                    // unsorted input
	}
	for _, tc := range cases {
		if got := percentile(tc.vals, tc.p); got != tc.want {
			t.Fatalf("percentile(%v, %d) = %d, want %d", tc.vals, tc.p, got, tc.want)
		}
	}
	// Input slice must not be mutated.
	in := []int{3, 1, 2}
	percentile(in, 50)
	if in[0] != 3 || in[1] != 1 || in[2] != 2 {
		t.Fatalf("percentile mutated input: %v", in)
	}
}
