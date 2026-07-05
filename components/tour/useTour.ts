"use client";

import { useContext } from "react";
import { TourContext } from "./TourProvider";

export const useTour = () => useContext(TourContext);
