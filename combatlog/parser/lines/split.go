package lines

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/types/realmclock"

	"github.com/coder/quartz"
)

const (
	LogDateFormat = "1/2 15:04:05.000"
)

type Liner struct {
	Year  int
	clock quartz.Clock

	disableTimeAdjust bool
	realm             *realmclock.Info
}

func NewLiner() *Liner {
	return &Liner{
		clock: quartz.NewReal(),
	}
}

func (l *Liner) WithoutTimeAdjustments() *Liner {
	l.disableTimeAdjust = true
	return l
}

func (l *Liner) SetClock(clock quartz.Clock) {
	l.clock = clock
}

func (l *Liner) RealmClockInfo() *realmclock.Info {
	return l.realm
}

func (l *Liner) SetYear(year int) {
	l.Year = year
}

func (l *Liner) GetYear() int {
	return l.Year
}

func (l *Liner) guessYear(line string) error {
	// Account for timezones
	now := l.clock.Now().Add(time.Hour * 24)
	this, _, err := l.parse(now.Year(), line)
	if err != nil {
		return err
	}
	before, _, err := l.parse(now.Year()-1, line)
	if err != nil {
		return err
	}

	// now should always be in the future
	// So if a date is in the future, then that year is incorrect.
	if this.Sub(now) > 0 {
		// this is in the future, go with the prior year
		l.Year = now.Year() - 1
		return nil
	}

	// Both dates are in the past. Pick the closest one.
	toThis := now.Sub(this)
	toBefore := now.Sub(before)

	if toBefore < toThis {
		l.Year = now.Year() - 1
		return nil
	}

	l.Year = now.Year()
	return nil
}

func (l *Liner) Line(line string) (time.Time, string, error) {
	if l.Year == 0 {
		err := l.guessYear(line)
		if err != nil {
			return time.Time{}, "", err
		}
	}

	return l.parse(l.Year, line)
}

func (l *Liner) parse(year int, line string) (time.Time, string, error) {
	parts := strings.SplitN(line, " ", 3)
	if len(parts) != 3 {
		return time.Time{}, "", errors.New("invalid line format")
	}

	content := strings.TrimPrefix(parts[2], " ")
	ts, err := time.ParseInLocation("2006 "+LogDateFormat, strconv.Itoa(year)+" "+parts[0]+" "+parts[1], time.UTC)
	if err != nil {
		return ts, content, err
	}

	if !l.disableTimeAdjust {
		if _, ok := realmclock.IsClockInfo(content); ok {
			info, err := realmclock.ParseClockInfo(content)
			if err == nil {
				l.realm = &info
			}
		}

		if l.realm != nil {
			// Fix the timestamp.
			ts = l.realm.Adjust(ts)
		}
	}

	return ts, strings.TrimPrefix(parts[2], " "), err
}

func (l *Liner) FmtLine(ts time.Time, content string) string {
	return ts.Format(LogDateFormat) + "  " + content
}
