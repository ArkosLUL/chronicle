-- samples: array of {col,row,luma}
table.sort(lumas)
thr = lumas[math.floor(#lumas/2)]

digits = {0,0,0,0,0,0}
for _, s in ipairs(samples) do
  local on = s.luma >= thr
  if on then
    local bit = bit.lshift(1, (rows-1 - s.row))
    digits[s.col+1] = bit.bor(digits[s.col+1], bit)
  end
end
