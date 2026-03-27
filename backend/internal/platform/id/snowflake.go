package id

import (
	"strconv"
	"sync"
	"time"
)

const (
	customEpoch  int64 = 1704067200000
	nodeBits           = 10
	sequenceBits       = 12
	maxSequence  int64 = -1 ^ (-1 << sequenceBits)
	nodeShift          = sequenceBits
	timeShift          = nodeBits + sequenceBits
)

type Snowflake struct {
	mu        sync.Mutex
	nodeID    int64
	lastStamp int64
	sequence  int64
}

func NewSnowflake(nodeID int64) *Snowflake {
	return &Snowflake{nodeID: nodeID & ((1 << nodeBits) - 1)}
}

func (s *Snowflake) NextString() string {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UnixMilli()
	if now == s.lastStamp {
		s.sequence = (s.sequence + 1) & maxSequence
		if s.sequence == 0 {
			for now <= s.lastStamp {
				now = time.Now().UnixMilli()
			}
		}
	} else {
		s.sequence = 0
	}

	s.lastStamp = now
	id := ((now - customEpoch) << timeShift) | (s.nodeID << nodeShift) | s.sequence
	return strconv.FormatInt(id, 10)
}
