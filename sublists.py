original_list = [['a'], ['a', 'b'], ['a', 'b', 'c'], ['a'], ['a', 'd'], ['a', 'd', 'e']]

# Initialize the result list
result = []

# Iterate over the original list
for sublist in original_list:
    # Create a flag to check if we are replacing a sublist
    replaced = False
    
    # Check if the current sublist is a superset of any existing sublist in result
    for i in range(len(result)):
        if set(sublist).issuperset(result[i]):
            result[i] = sublist  # Replace the sublist in the result
            replaced = True
            break  # No need to check further once we have replaced
    
    # If it wasn't a superset of any existing sublist, add it to the result
    if not replaced:
        result.append(sublist)
    print(result)

# print(result)


