import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  willRain: boolean;
  description: string;
}

export const useWeatherData = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = async (latitude: number, longitude: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('weather-data', {
        body: { latitude, longitude }
      });

      if (functionError) throw functionError;

      if (data) {
        setWeather(data);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao buscar dados climáticos");
      console.error("Weather fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return { weather, isLoading, error, fetchWeather };
};
