echo "extracting $1 to ${1%.*}"
  python3 extract_mview.py "$1"                                                                                                                                                          
  echo "$1 extracted to ${1%.*}"                                                                                                                                                       
  echo "converting files from ${1%.*}"                                                                                                                                                   
  python3 convert_model.py "${1%.*}"                                                                                                                                                     
  echo "$1 converted"

