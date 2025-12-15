import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Icon } from '../atoms';

interface DatePickerPopupProps {
  visible: boolean;
  selectedDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

export const DatePickerPopup = ({
  visible,
  selectedDate,
  onSelect,
  onClose,
}: DatePickerPopupProps) => {
  const [viewDate, setViewDate] = useState(() => new Date(selectedDate));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const calendarData = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days: (number | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    // Add the days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  }, [year, month]);

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleDayPress = (day: number) => {
    const newDate = new Date(year, month, day);
    onSelect(newDate);
    onClose();
  };

  const isSelected = (day: number) => {
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === month &&
      selectedDate.getFullYear() === year
    );
  };

  // Create rows of 7 days
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < calendarData.length; i += 7) {
    weeks.push(calendarData.slice(i, i + 7));
  }

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.popup} onPress={(e) => e.stopPropagation()}>
          {/* Header with month navigation */}
          <View style={styles.header}>
            <Pressable
              onPress={handlePrevMonth}
              style={styles.navButton}
              accessibilityLabel="Previous month"
            >
              <Icon icon={ChevronLeft} size={20} color="#111827" />
            </Pressable>
            <Text style={styles.monthTitle}>{MONTHS[month]}</Text>
            <Pressable
              onPress={handleNextMonth}
              style={styles.navButton}
              accessibilityLabel="Next month"
            >
              <Icon icon={ChevronRight} size={20} color="#111827" />
            </Pressable>
          </View>

          {/* Days of week header */}
          <View style={styles.daysHeader}>
            {DAYS_OF_WEEK.map((day, index) => (
              <View key={index} style={styles.dayHeaderCell}>
                <Text style={styles.dayHeaderText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.calendarGrid}>
            {weeks.map((week, weekIndex) => (
              <View key={weekIndex} style={styles.weekRow}>
                {week.map((day, dayIndex) => (
                  <Pressable
                    key={dayIndex}
                    style={styles.dayCell}
                    onPress={() => day && handleDayPress(day)}
                    disabled={!day}
                  >
                    {day && (
                      <View
                        style={[
                          styles.dayContent,
                          isSelected(day) && styles.selectedDay,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            isSelected(day) && styles.selectedDayText,
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ))}
                {/* Fill remaining cells if week is incomplete */}
                {Array.from({ length: 7 - week.length }).map((_, i) => (
                  <View key={`empty-${i}`} style={styles.dayCell} />
                ))}
              </View>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  popup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  navButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  daysHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  calendarGrid: {
    gap: 4,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayContent: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  selectedDay: {
    backgroundColor: '#2563EB',
  },
  dayText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});




