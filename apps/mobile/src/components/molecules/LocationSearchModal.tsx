import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    Modal,
    TextInput,
    Pressable,
    FlatList,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Search, X, Navigation, Video, Mic, MapPin, Briefcase, Home } from 'lucide-react-native';
import { Icon } from '../atoms/Icon';

// Surgical fix: Use a guarded require for expo-location 
// to prevent "Cannot find native module 'ExpoLocation'" crashes
// when the native code isn't yet compiled into the binary.
let Location: any = null;
try {
    Location = require('expo-location');
} catch (e) {
    // handled via check below
}

interface LocationResult {
    id: string;
    name: string;
    address: string;
    type: 'location' | 'video' | 'suggestion';
}

interface LocationSearchModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (location: string) => void;
}

export const LocationSearchModal = ({ visible, onClose, onSelect }: LocationSearchModalProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<LocationResult[]>([]);
    const [loading, setLoading] = useState(false);

    // Mock suggestions - in production these would come from user profile
    const suggestions: LocationResult[] = [
        { id: 'work', name: 'Work', address: '8701 RM-2338, Georgetown TX', type: 'suggestion' },
        { id: 'home', name: 'Home', address: '455 Logan Rd, Georgetown TX', type: 'suggestion' },
    ];

    const searchLocations = async (query: string) => {
        if (query.length < 2) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            // Using Photon (OpenStreetMap) API - Free, no key required
            const response = await fetch(
                `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10`
            );
            const data = await response.json();
            
            const mappedResults: LocationResult[] = data.features.map((feature: any, index: number) => {
                const { name, street, city, state, country } = feature.properties;
                const addressParts = [street, city, state, country].filter(Boolean);
                return {
                    id: `result-${index}`,
                    name: name || street || city || 'Unknown Location',
                    address: addressParts.join(', '),
                    type: 'location',
                };
            });

            setResults(mappedResults);
        } catch (error) {
            console.error('Location search failed:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery) {
                searchLocations(searchQuery);
            } else {
                setResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleGetCurrentLocation = async () => {
        if (!Location || !Location.requestForegroundPermissionsAsync) {
            alert('Location services are not available in this build yet. Please rebuild the app.');
            return;
        }

        setLoading(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                alert('Permission to access location was denied');
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            const [address] = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });

            if (address) {
                const locationStr = [address.name, address.street, address.city, address.region]
                    .filter(Boolean)
                    .join(', ');
                onSelect(locationStr);
                onClose();
            }
        } catch (error) {
            console.error('Error getting current location:', error);
            alert('Could not determine your location.');
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: LocationResult }) => (
        <Pressable
            onPress={() => {
                onSelect(item.type === 'suggestion' ? item.address : item.name + (item.address ? `, ${item.address}` : ''));
                onClose();
            }}
            className="flex-row items-center px-4 py-3 border-b border-[#F2F2F7]"
        >
            <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                item.type === 'suggestion' ? 'bg-[#F2F2F7]' : 
                item.type === 'video' ? 'bg-[#34C759]' : 'bg-[#F2F2F7]'
            }`}>
                <Icon 
                    icon={
                        item.type === 'video' ? Video : 
                        item.id === 'work' ? Briefcase : 
                        item.id === 'home' ? Home : 
                        MapPin
                    } 
                    size={16} 
                    color={item.type === 'video' ? 'white' : '#8E8E93'} 
                />
            </View>
            <View className="flex-1">
                <Text className="text-lg font-semibold text-[#111827]">{item.name}</Text>
                {item.address && (
                    <Text className="text-sm text-[#8E8E93]" numberOfLines={1}>{item.address}</Text>
                )}
            </View>
        </Pressable>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-[#F2F2F7]">
                {/* Header */}
                <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
                    <View style={{ width: 40 }} />
                    <Text className="text-lg font-bold text-[#111827]">Location</Text>
                    <Pressable 
                        onPress={onClose}
                        className="w-8 h-8 rounded-full bg-[#E5E5EA] items-center justify-center"
                    >
                        <Icon icon={X} size={18} color="#8E8E93" />
                    </Pressable>
                </View>

                {/* Search Bar */}
                <View className="px-4 py-2">
                    <View className="flex-row items-center bg-[#E5E5EA] rounded-xl px-3 py-2">
                        <Icon icon={Search} size={18} color="#8E8E93" />
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Enter Location or Video Call"
                            placeholderTextColor="#8E8E93"
                            className="flex-1 ml-2 text-lg text-[#111827]"
                            autoFocus
                        />
                        <Icon icon={Mic} size={18} color="#8E8E93" />
                    </View>
                </View>

                {/* Main Content */}
                <ScrollView className="flex-1">
                    {!searchQuery && (
                        <>
                            {/* Suggestions */}
                            <View className="mt-2 bg-white">
                                {suggestions.map((item) => (
                                    <Pressable
                                        key={item.id}
                                        onPress={() => {
                                            onSelect(item.address);
                                            onClose();
                                        }}
                                        className="flex-row items-center px-4 py-3 border-b border-[#F2F2F7]"
                                    >
                                        <View className="w-8 h-8 rounded-full bg-[#F2F2F7] items-center justify-center mr-3">
                                            <Icon icon={item.id === 'work' ? Briefcase : Home} size={16} color="#8E8E93" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-lg font-semibold text-[#111827]">{item.name}</Text>
                                            <Text className="text-sm text-[#8E8E93]" numberOfLines={1}>{item.address}</Text>
                                        </View>
                                    </Pressable>
                                ))}
                            </View>

                            {/* Current Location */}
                            <Pressable 
                                onPress={handleGetCurrentLocation}
                                className="flex-row items-center px-4 py-4 bg-white mt-4"
                            >
                                <View className="w-8 h-8 rounded-full bg-[#007AFF] items-center justify-center mr-3">
                                    <Icon icon={Navigation} size={16} color="white" />
                                </View>
                                <Text className="text-lg text-[#007AFF] font-semibold">Current Location</Text>
                            </Pressable>

                            {/* Video Call */}
                            <View className="px-4 py-2 mt-6">
                                <Text className="text-xs font-semibold text-[#8E8E93] uppercase">Video Call</Text>
                            </View>
                            <Pressable 
                                onPress={() => {
                                    onSelect('FaceTime');
                                    onClose();
                                }}
                                className="flex-row items-center px-4 py-3 bg-white"
                            >
                                <View className="w-8 h-8 rounded-full bg-[#34C759] items-center justify-center mr-3">
                                    <Icon icon={Video} size={16} color="white" />
                                </View>
                                <Text className="text-lg text-[#111827] font-semibold">FaceTime</Text>
                            </Pressable>
                        </>
                    )}

                    {loading && (
                        <View className="py-8">
                            <ActivityIndicator color="#007AFF" />
                        </View>
                    )}

                    {searchQuery && !loading && (
                        <View className="bg-white">
                            <FlatList
                                data={results}
                                renderItem={renderItem}
                                keyExtractor={(item) => item.id}
                                scrollEnabled={false}
                            />
                        </View>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
};
